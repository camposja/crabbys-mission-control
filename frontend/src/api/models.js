import client from "./client";

export const modelsApi = {
  getAll:  () => client.get("/models").then(r => r.data),
  getLive: () => client.get("/models/live").then(r => r.data),
};
