import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  addRxPlugin,
  createRxDatabase,
  RxCollection,
  RxDatabase,
  RxGraphQLReplicationQueryBuilder,
  RxJsonSchema,
} from 'rxdb';
import { RxDBReplicationGraphQLPlugin } from 'rxdb/plugins/replication-graphql';
import './App.css';

addRxPlugin(require('pouchdb-adapter-idb'));
addRxPlugin(RxDBReplicationGraphQLPlugin);

interface User {
  id: string;
  updatedAt: number;
}

const schema: RxJsonSchema<User> = {
  title: 'user schema',
  version: 0,
  description: 'describe users',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      primary: true,
    },
    updatedAt: {
      type: 'number',
    },
  },
  required: ['updatedAt'],
};

type Collections = Record<string, RxCollection<User>>;

// Pull items to local from remote database
const pullQueryBuilder: RxGraphQLReplicationQueryBuilder = (doc: User) => {
  if (!doc) {
    doc = {
      id: '',
      updatedAt: 0,
    };
  }

  console.log('PULL', doc);

  const query = `
    query SyncUsers($lastId: String!, $minUpdatedAt: AWSTimestamp!) {
      syncUsers(lastId: $lastId, minUpdatedAt: $minUpdatedAt) {
        id
        deleted
        updatedAt
      }
    }
  `;

  const variables = {
    lastId: doc.id,
    minUpdatedAt: doc.updatedAt + 1,
  };

  return {
    query,
    variables,
  };
};

// Push items to remote from local database
const pushQueryBuilder: RxGraphQLReplicationQueryBuilder = (doc: User) => {
  const query = `
    mutation CreateUser($input: CreateUserInput!) {
      createUser(input: $input) {
        id
        deleted
        updatedAt
      }
    }
  `;

  console.log('PUSH', doc);

  const variables = {
    input: {
      id: doc.id,
      updatedAt: doc.updatedAt,
      deleted: false,
    },
  };

  return {
    query,
    variables,
  };
};

function App() {
  const [database, setDatabase] = useState<RxDatabase<Collections>>();

  const createDatabase = useCallback(async () => {
    const database = await createRxDatabase<Collections>({
      name: 'usersdb',
      adapter: 'idb',
    });

    await database.addCollections({
      users: {
        schema,
      },
    });

    const replicationState = database.users.syncGraphQL({
      url: 'https://123.appsync-api.us-west-2.amazonaws.com/graphql',
      deletedFlag: 'deleted',
      live: true,
      headers: {
        'X-API-KEY': '456',
      },
      autoStart: true,
      liveInterval: 1000 * 10,
      pull: {
        queryBuilder: pullQueryBuilder,
      },
      push: {
        queryBuilder: pushQueryBuilder,
      },
    });

    replicationState.error$.subscribe((error) => console.log('REPL ERROR', error));

    setDatabase(database);
  }, []);

  // Create database
  useEffect(() => {
    createDatabase();
  }, [createDatabase]);

  const [id, setId] = useState('');

  // Insert items into database
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!disabled) {
      const user = await database?.users.insert({
        id,
        updatedAt: Date.now(),
      });

      console.log('CREATE', user);
    }
  };

  const [users, setUsers] = useState<string[]>();

  // Subscribe to items from database
  useEffect(() => {
    console.log('SUBSCRIBE');
    const getUsers = database?.users.find();
    getUsers?.$.subscribe((users) => setUsers(users.map((users) => users.get('id'))));
  }, [database?.users]);

  const [disabled, setDisabled] = useState(false);

  // Read item from database
  useEffect(() => {
    const findAndDisable = async () => {
      const user = await database?.users.findOne().where('id').eq(id).exec();

      if (user) {
        setDisabled(true);
      } else if (disabled) {
        setDisabled(false);
      }
    };

    findAndDisable();
  }, [database?.users, disabled, id]);

  return (
    <div className='App-header'>
      <form onSubmit={handleSubmit}>
        <label>
          ID:
          <input type='text' value={id} onChange={(event) => setId(event.target.value)} />
        </label>
        <input type='submit' value='Create user' disabled={disabled} />
      </form>
      {users?.map((user) => (
        <p key={user}>{user}</p>
      ))}
    </div>
  );
}

export default App;
