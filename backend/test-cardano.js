const { BlockFrostAPI } = require("@blockfrost/blockfrost-js");
require("dotenv").config();

const api = new BlockFrostAPI({
  projectId: process.env.BLOCKFROST_KEY,
  network: "preprod",
});

async function test() {
  const latestBlock = await api.blocksLatest();
  console.log("✅ Connected! Latest block:", latestBlock.height);
}

test().catch(console.error);