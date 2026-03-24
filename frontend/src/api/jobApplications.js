import client from "./client";

export const jobApplicationsApi = {
  getAll: (params) => client.get("/job_applications", { params }).then(r => r.data),
  getGroupedByDate: (params) => client.get("/job_applications/grouped_by_date", { params }).then(r => r.data),
  create: (data) => client.post("/job_applications", { job_application: data }).then(r => r.data),
  update: (id, data) => client.patch(`/job_applications/${id}`, { job_application: data }).then(r => r.data),
  sync: () => client.post("/job_applications/sync").then(r => r.data),
};
