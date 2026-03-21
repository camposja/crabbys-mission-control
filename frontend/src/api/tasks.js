import client from "./client";

export const tasksApi = {
  getAll:   (params) => client.get("/tasks", { params }).then(r => r.data),
  get:      (id)     => client.get(`/tasks/${id}`).then(r => r.data),
  create:   (data)   => client.post("/tasks", { task: data }).then(r => r.data),
  update:   (id, data) => client.patch(`/tasks/${id}`, { task: data }).then(r => r.data),
  move:     (id, column) => client.patch(`/tasks/${id}/move`, { column }).then(r => r.data),
  destroy:  (id)     => client.delete(`/tasks/${id}`).then(r => r.data),
};
