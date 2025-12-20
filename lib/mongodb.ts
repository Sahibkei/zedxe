import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;

declare global {
    var mongoClientPromise: Promise<MongoClient> | undefined;
}

export const getMongoClient = async () => {
    if (!MONGODB_URI) {
        return null;
    }

    if (!global.mongoClientPromise) {
        const client = new MongoClient(MONGODB_URI);
        global.mongoClientPromise = client.connect();
    }

    return global.mongoClientPromise;
};
