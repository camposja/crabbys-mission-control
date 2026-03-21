import client from "./client";

export const usageApi = {
  getAll:           (params) => client.get("/usage", { params }).then(r => r.data),
  getTimeline:      (params) => client.get("/usage/timeline", { params }).then(r => r.data),
  getThresholds:    ()       => client.get("/usage/thresholds").then(r => r.data),
  updateThresholds: (data)   => client.patch("/usage/thresholds", data).then(r => r.data),
  getDiagnostics:   ()       => client.get("/diagnostics").then(r => r.data),
  restartGateway:   ()       => client.post("/diagnostics/restart_gateway").then(r => r.data),
};
