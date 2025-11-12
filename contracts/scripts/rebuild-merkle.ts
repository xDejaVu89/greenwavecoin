import axios from "axios";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";
  console.log("Rebuilding merkle tree via", `${backendUrl}/api/fah/rebuild-tree`);
  const res = await axios.post(`${backendUrl}/api/fah/rebuild-tree`);
  console.log("Response:", res.data);
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
