// Bootstrap. The first import is a side-effect-only module that loads the
// repo-root .env BEFORE any downstream module (server → routes → middleware)
// reads process.env at its own load time. ES imports evaluate in declaration
// order, so `./load-env` runs before `./server`.
//
// The legacy Mongoose+JWT path (utils/{app,mongo,jwt,crypt}, routes/auth,
// controllers/auth, models/Account, middlewares/check-bearer-token) is left
// in place but no longer referenced. Delete after the new path is verified
// end-to-end per docs/SECURITY.md migration plan.

import "./load-env";
import { startServer } from "./server";

startServer();
