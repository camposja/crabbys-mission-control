import client from "./client";

export const openclawApi = {
  getAgents: ()          => client.get("/openclaw/agents").then(r => r.data),
  getAgent: (id)         => client.get(`/openclaw/agents/${id}`).then(r => r.data),
  getSessions: ()        => client.get("/openclaw/sessions").then(r => r.data),
  sendMessage: (payload) => client.post("/openclaw/message", { message: payload }).then(r => r.data),
};
