import client from "./client";

export const dashboardApi = {
  getStats:          ()      => client.get("/stats").then(r => r.data),
  getGateway:        ()      => client.get("/gateway").then(r => r.data),
  getUpcoming:       (limit) => client.get("/calendar/upcoming", { params: { limit } }).then(r => r.data),
  getRecentEvents:   (count) => client.get("/events/recent", { params: { count } }).then(r => r.data),
  getMissionStatement: ()    => client.get("/mission_statement").then(r => r.data),
  updateMissionStatement: (content) =>
    client.patch("/mission_statement", { mission_statement: { content } }).then(r => r.data),
};
