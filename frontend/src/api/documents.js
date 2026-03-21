import client from "./client";

export const documentsApi = {
  getAll:        () => client.get("/documents").then(r => r.data),
  getContent:    (path) => client.get("/documents/content", { params: { path } }).then(r => r.data),
  updateContent: (path, content) =>
    client.patch("/documents/content", { path, content }).then(r => r.data),
};
