import client from "./client";

export const memoriesApi = {
  getAll:       (params) => client.get("/memories", { params }).then(r => r.data),
  getOne:       (id)     => client.get(`/memories/${id}`).then(r => r.data),
  search:       (q)      => client.get("/memories/search", { params: { q } }).then(r => r.data),
  update:       (id, data) => client.patch(`/memories/${id}`, { memory: data }).then(r => r.data),
  destroy:      (id)     => client.delete(`/memories/${id}`).then(r => r.data),
  getJournal:   (path)   => client.get("/memories/journal", { params: { path } }).then(r => r.data),
  updateJournal:(path, content) =>
    client.patch("/memories/journal", { path, content }).then(r => r.data),
};
