import client from "./client";

export const personalTodosApi = {
  getAll:     () => client.get("/personal_todos").then(r => r.data),
  getArchived:() => client.get("/personal_todos/archived").then(r => r.data),
  create:     (data) => client.post("/personal_todos", { personal_todo: data }).then(r => r.data),
  update:     (id, data) => client.patch(`/personal_todos/${id}`, { personal_todo: data }).then(r => r.data),
  toggle:     (id) => client.patch(`/personal_todos/${id}/toggle`).then(r => r.data),
  archive:    (id) => client.patch(`/personal_todos/${id}/archive`).then(r => r.data),
  unarchive:  (id) => client.patch(`/personal_todos/${id}/unarchive`).then(r => r.data),
  destroy:    (id) => client.delete(`/personal_todos/${id}`).then(r => r.data),
};
