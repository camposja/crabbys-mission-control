import client from "./client";

// Reusable polymorphic notes. Owner is passed via notable_type + notable_id.
export const notesApi = {
  getAll:  (params)   => client.get("/notes", { params }).then(r => r.data),
  create:  (data)     => client.post("/notes", { note: data }).then(r => r.data),
  update:  (id, data) => client.patch(`/notes/${id}`, { note: data }).then(r => r.data),
  destroy: (id)       => client.delete(`/notes/${id}`).then(r => r.data),
};
