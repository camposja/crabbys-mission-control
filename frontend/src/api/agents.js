import client from "./client";

export const agentsApi = {
  getAll:    ()   => client.get("/agents").then(r => r.data),
  getOne:    (id) => client.get(`/agents/${id}`).then(r => r.data),
  pause:     (id) => client.post(`/agents/${id}/pause`).then(r => r.data),
  resume:    (id) => client.post(`/agents/${id}/resume`).then(r => r.data),
  terminate: (id) => client.delete(`/agents/${id}`).then(r => r.data),
};
