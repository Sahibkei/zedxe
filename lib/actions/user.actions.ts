'use server';

import { Types } from 'mongoose';

import {connectToDatabase} from "@/database/mongoose";

export const getAllUsersForNewsEmail = async () => {
    try {
        const mongoose = await connectToDatabase();
        const db = mongoose.connection.db;
        if(!db) throw new Error('Mongoose connection not connected');

        const users = await db.collection('user').find(
            { email: { $exists: true, $ne: null }},
            { projection: { _id: 1, id: 1, email: 1, name: 1, country:1 }}
        ).toArray();

        return users.filter((user) => user.email && user.name).map((user) => ({
            id: user.id || user._id?.toString() || '',
            email: user.email,
            name: user.name
        }))
    } catch (e) {
        console.error('Error fetching users for news email:', e)
        return []
    }
}

export const getUserById = async (userId: string) => {
    if (!userId) return null;

    try {
        const mongoose = await connectToDatabase();
        const db = mongoose.connection.db;
        if (!db) throw new Error('Mongoose connection not connected');

        const candidates = [{ id: userId } as Record<string, unknown>];
        if (Types.ObjectId.isValid(userId)) {
            candidates.push({ _id: new Types.ObjectId(userId) } as Record<string, unknown>);
        }

        const user = await db.collection('user').findOne(
            { $or: candidates },
            { projection: { _id: 1, id: 1, email: 1, name: 1 } }
        );

        if (!user || !user.email) return null;
        return {
            id: user.id || user._id?.toString() || userId,
            email: user.email,
            name: user.name,
        } as UserForNewsEmail;
    } catch (error) {
        console.error('Error fetching user by id:', error);
        return null;
    }
}