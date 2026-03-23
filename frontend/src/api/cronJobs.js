import client from "./client";

export const cronJobsApi = {
  getAll:   ()           => client.get("/cron_jobs").then(r => r.data),
  create:   (data)       => client.post("/cron_jobs", { cron_job: data }).then(r => r.data),
  update:   (id, data)   => client.patch(`/cron_jobs/${id}`, { cron_job: data }).then(r => r.data),
  destroy:  (id)         => client.delete(`/cron_jobs/${id}`).then(r => r.data),
  toggle:   (id)         => client.patch(`/cron_jobs/${id}/toggle`).then(r => r.data),
  runNow:   (id)         => client.post(`/cron_jobs/${id}/run_now`).then(r => r.data),
};
