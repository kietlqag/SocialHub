Backend MongoDB (socialhub) setup

This backend can optionally connect to a MongoDB database named "socialhub" for features that live in MongoDB.

Environment variables used:

- MONGODB_SOCIALHUB_URI - full connection URI for the socialhub MongoDB instance. If omitted, the code will try MONGODB_URI as a fallback.
- MONGODB_SOCIALHUB_DBNAME - logical DB name to open (defaults to `socialhub`).

Usage notes:

- The Mongo connector is implemented in `src/mongo.js`. Call `initMongo()` (the server will do this on start) and use `getSocialhubDb()` to obtain the `Db` instance.
For quick test endpoints we've added (notifications are now stored in Postgres):
  - GET /notifications — read all notifications from Postgres
  - POST /notifications — add a notification (pass JSON body)
  - PATCH /notifications/:id — update (mark read, etc.)
  - DELETE /notifications/:id — delete a notification by id

  Note: temporary seeding and migration scripts used during development were removed after migration completed. If you need them again you can recreate them from version history.

Example MONGODB_SOCIALHUB_URI (Compass / connection string):

mongodb+srv://<user>:<password>@cluster0.mongodb.net/?retryWrites=true&w=majority
