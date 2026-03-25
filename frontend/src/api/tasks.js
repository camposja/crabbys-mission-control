import client from "./client";

export const tasksApi = {
  getAll:       (params)       => client.get("/tasks", { params }).then(r => r.data),
  get:          (id)           => client.get(`/tasks/${id}`).then(r => r.data),
  create:       (data)         => client.post("/tasks", { task: data }).then(r => r.data),
  update:       (id, data)     => client.patch(`/tasks/${id}`, { task: data }).then(r => r.data),
  move:         (id, column)   => client.patch(`/tasks/${id}/move`, { column }).then(r => r.data),
  destroy:      (id)           => client.delete(`/tasks/${id}`).then(r => r.data),
  // Planning
  getPlan:      (id, answers)  => client.post(`/tasks/${id}/plan`, { answers }).then(r => r.data),
  approvePlan:  (id, plan, spawn = false) => client.post(`/tasks/${id}/plan_approve`, { plan, spawn }).then(r => r.data),
};
