# RxDB Demo

This project demos the use of [RxDB][rxdb] to sync an offline database with the Cloud.

We use RxDB to set up a local database in the browser using the [IndexedDB API][indexeddb] adapter. Then, we set up replication with the Cloud using an [AWS AppSync GraphQL API][appsync].

Run `yarn start` to start the demo app. Note: you'll have to set up the GraphQL API with the expected schema yourself.

[rxdb]: https://rxdb.info/
[indexeddb]: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
[appsync]: https://aws.amazon.com/appsync/
