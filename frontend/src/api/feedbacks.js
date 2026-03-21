import client from "./client";

export const feedbacksApi = {
  getAll:        ()          => client.get("/feedbacks").then(r => r.data),
  getOne:        (id)        => client.get(`/feedbacks/${id}`).then(r => r.data),
  create:        (data)      => client.post("/feedbacks", { feedback: data }).then(r => r.data),
  updateStatus:  (id, status)=> client.patch(`/feedbacks/${id}/update_status`, { status }).then(r => r.data),
};
