import client from "./client";

export const projectsApi = {
  getAll:       ()             => client.get("/projects").then(r => r.data),
  get:          (id)           => client.get(`/projects/${id}`).then(r => r.data),
  create:       (data)         => client.post("/projects", { project: data }).then(r => r.data),
  update:       (id, data)     => client.patch(`/projects/${id}`, { project: data }).then(r => r.data),
  destroy:      (id)           => client.delete(`/projects/${id}`).then(r => r.data),
  getSummary:   (id)           => client.get(`/projects/${id}/summary`).then(r => r.data),
  getActivity:  (id, params)   => client.get(`/projects/${id}/activity`, { params }).then(r => r.data),
};
