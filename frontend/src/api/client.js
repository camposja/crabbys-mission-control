import axios from "axios";
import { API_URL } from "../lib/config";

const client = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

export default client;
