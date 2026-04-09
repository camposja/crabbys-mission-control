import client from "./client";

export const linksApi = {
  getAll:  (params) => client.get("/links", { params }).then(r => r.data),
  create:  (data) => client.post("/links", { link: data }).then(r => r.data),
  destroy: (id) => client.delete(`/links/${id}`).then(r => r.data),
};
