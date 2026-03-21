import client from "./client";

export const securityApi = {
  getAudit:       () => client.get("/security/audit").then(r => r.data),
  getRemoteAccess:() => client.get("/security/remote_access").then(r => r.data),
  getPermissions: () => client.get("/security/permissions").then(r => r.data),
};
