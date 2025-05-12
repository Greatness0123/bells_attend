

// config/appwriteConfig.ts
import { Client, Databases, Storage, Account } from 'appwrite';

const client = new Client();

client
  .setEndpoint('https://fra.cloud.appwrite.io/v1')
  .setProject('680ccc8c0033d0a0985d');

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);

export { client };
