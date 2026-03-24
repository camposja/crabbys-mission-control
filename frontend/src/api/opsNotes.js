import client from "./client";

export const opsNotesApi = {
  getAll:  (params = {}) => client.get("/ops_notes", { params }).then(r => r.data),
  get:     (id, params = {}) => client.get(`/ops_notes/${id}`, { params }).then(r => r.data),
  create:  (data) => client.post("/ops_notes", { ops_note: data }).then(r => r.data),
  update:  (id, data) => client.patch(`/ops_notes/${id}`, { ops_note: data }).then(r => r.data),
  destroy: (id) => client.delete(`/ops_notes/${id}`).then(r => r.data),
};
