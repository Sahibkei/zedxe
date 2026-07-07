import { ObjectId, type Db, type Document, type Filter } from "mongodb";

const USER_COLLECTION = "user";

export const getUserIdentityFilters = (userId: string): Filter<Document>[] => {
    const filters: Filter<Document>[] = [{ id: userId }];
    if (ObjectId.isValid(userId)) {
        filters.push({ _id: new ObjectId(userId) });
    }
    return filters;
};

export const findUserBySessionId = async <T extends Document = Document>(
    db: Db,
    userId: string,
    projection?: Document,
) =>
    db.collection(USER_COLLECTION).findOne<T>(
        { $or: getUserIdentityFilters(userId) },
        projection ? { projection } : undefined,
    );

export const findResearchWireUserById = async <T extends Document = Document>(
    db: Db,
    userId: string,
    projection?: Document,
) => findUserBySessionId<T>(db, userId, projection);

export const mapResearchWireUser = (user: Document) => ({
    id:
        typeof user.id === "string"
            ? user.id
            : user._id instanceof ObjectId
              ? user._id.toString()
              : String(user._id),
    name: typeof user.name === "string" ? user.name : "ZedXe user",
    username: typeof user.username === "string" ? user.username : null,
    image: typeof user.image === "string" ? user.image : null,
    bio: typeof user.bio === "string" ? user.bio : null,
});
