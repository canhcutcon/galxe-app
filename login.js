require("dotenv").config();
const { ethers } = require("ethers");
const axios = require("axios");

const RPC_URL = "https://bsc-dataseed.binance.org";
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const walletAddress = wallet.address;

const GALXE_API_URL = "https://graphigo.prd.galaxy.eco/query";
const JWT_TOKEN = process.env.GALXE_JWT;

async function createAccount(walletAddress, username) {
  const query = `
    mutation CreateNewAccount($input: CreateNewAccount!) {
      createNewAccount(input: $input)
    }
  `;

  const variables = {
    input: {
      schema: `EVM:${walletAddress}`,
      socialUsername: username,
      username: username,
    },
  };

  try {
    const response = await axios.post(
      GALXE_API_URL,
      { query, variables },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${JWT_TOKEN}`,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
    throw error.response?.data || error.message;
  }
}

async function checkProfileLevel(walletAddress) {
  const query = `
    query ProfileUserLevel($address: String!) {
      addressInfo(address: $address) {
        id
        userLevel {
          level {
            name
            logo
            minExp
            maxExp
            value
          }
          exp
          gold
        }
      }
    }
  `;

  const variables = {
    address: walletAddress,
  };

  try {
    const response = await axios.post(
      GALXE_API_URL,
      {
        operationName: "ProfileUserLevel",
        query,
        variables,
      },
      {
        headers: {
          "Content-Type": "application/json",
          platform: "web",
          origin: "https://app.galxe.com",
          "user-agent": "Node.js Server",
        },
      }
    );

    return response.data.data.addressInfo;
  } catch (error) {
    console.error(
      "Error checking profile:",
      error.response?.data || error.message
    );
    throw error.response?.data || error.message;
  }
}

async function getUserBalance(walletAddress) {
  const query = `
    query GetBalance($address: String!) {
      GetBalance(address: $address) {
        token
        balance
        pendingAmount
      }
    }
  `;

  const variables = { address: walletAddress };

  try {
    const response = await axios.post(
      "https://savings-graphigo.prd.latch.io/query",
      { query, variables, operationName: "GetBalance" },
      {
        headers: {
          "Content-Type": "application/json",
          Origin: "https://app.galxe.com",
          "User-Agent": "Node.js Server",
        },
      }
    );

    return response.data.data.GetBalance;
  } catch (error) {
    console.error(
      "Error getting balance:",
      error.response?.data || error.message
    );
    throw error;
  }
}
async function checkTaskCondition(campaignId, walletAddress) {
  const query = `
    query QuestCredList($id: ID!, $address: String!) {
      campaign(id: $id) {
        id
        taskConfig(address: $address) {
          participateCondition {
            eligible
            conditions {
              attrFormula
              eligible
            }
          }
          rewardConfigs {
            eligible
            description
            rewards {
              rewardType
              rewardVal
            }
          }
        }
      }
    }
  `;

  const variables = { id: campaignId, address: walletAddress };

  try {
    const response = await axios.post(
      "https://graphigo.prd.galaxy.eco/query",
      { query, variables, operationName: "QuestCredList" },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GALXE_JWT}`,
          Origin: "https://app.galxe.com",
          Platform: "web",
        },
      }
    );

    return response.data.data.campaign;
  } catch (error) {
    console.error(
      "Error checking task:",
      error.response?.data || error.message
    );
    throw error;
  }
}

async function getClaimableActivities(walletAddress) {
  const query = `
    query GetGlobalNotification($address: String!) {
      claimable: Activities(req: { addr: $address, activityType: [5], state: [2], first: 1 }) {
        list {
          timestamp
          activityType
          state
        }
      }
      pending: Activities(req: { addr: $address, activityType: [4, 5], state: [0], first: 1 }) {
        list {
          timestamp
          activityType
          state
        }
      }
      recent: Activities(req: { addr: $address, activityType: [4, 5], state: [1, 4], first: 20 }) {
        list {
          timestamp
          activityType
          state
        }
      }
    }
  `;

  const variables = { address: walletAddress };

  try {
    const response = await axios.post(
      "https://savings-graphigo.prd.latch.io/query",
      { query, variables, operationName: "GetGlobalNotification" },
      {
        headers: {
          "Content-Type": "application/json",
          Origin: "https://app.galxe.com",
          "User-Agent": "Node.js Server",
        },
      }
    );

    return response.data.data;
  } catch (error) {
    console.error(
      "Error getting claimable activities:",
      error.response?.data || error.message
    );
    throw error;
  }
}

async function getAllCampaigns(address) {
  const query = `
    query CampaignList($input: ListCampaignInput!, $address: String!) {
      campaigns(input: $input) {
        pageInfo {
          endCursor
          hasNextPage
        }
        list {
          id
          name
          status
          description
          thumbnail
          rewardName
          chain
          startTime
          endTime
        }
      }
    }
  `;

  const variables = {
    address,
    input: {
      listType: "Trending",
      listTrendingWithoutFilter: true,
      first: 20,
      after: "-1",
    },
  };

  const response = await axios.post(
    GALXE_API_URL,
    { query, variables },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${JWT_TOKEN}`,
        platform: "web",
        origin: "https://app.galxe.com",
      },
    }
  );

  return response.data.data.campaigns;
}
async function getUserRewards() {
  const query = `
    query UserRewardTask($input: ListUserTaskRequest!) {
      listUserTasks(request: $input) {
        list {
          id
          name
          jumpUrl
          userTaskConfig {
            eligible
            rewardConfig {
              rewardCount
              tokenDetail {
                tokenLogo
                tokenSymbol
              }
            }
          }
        }
      }
    }
  `;

  const variables = {
    input: {
      filterTaskTypes: ["GalxeRewardTask"],
    },
  };

  const response = await axios.post(
    GALXE_API_URL,
    { query, variables },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${JWT_TOKEN}`,
        platform: "web",
        origin: "https://app.galxe.com",
      },
    }
  );

  return response.data.data.listUserTasks.list;
}
async function getTotalAndYesterdayProfit(address) {
  const query = `
    query GetTotalAndYesterdayProfit($address: String!) {
      totalProfit: GetLSDTotalProfit(address: $address) {
        totalProfit
        lsdToken
        endTime
        beginTime
      }
      profitHistory: GetLSDProfitHistory(req: {address: $address, first: 1}) {
        profitList {
          profit
          lsdToken
          timestamp
          profitType
        }
        timestamp
      }
    }
  `;

  const variables = { address };

  const response = await axios.post(
    "https://savings-graphigo.prd.latch.io/query",
    { query, variables },
    {
      headers: {
        "Content-Type": "application/json",
        origin: "https://app.galxe.com",
      },
    }
  );

  return response.data.data;
}

const { v4: uuidv4 } = require("uuid");
const { SigningKey } = require("ethers/lib/utils");
const username = `${uuidv4()}_${walletAddress.slice(2, 6)}`;
// createAccount(walletAddress, "testuser"); // user name = uuid+walletAddress

checkProfileLevel("0x48b65493F192d6b06E31483a9230595f44bC696E")
  .then((info) => {
    console.log("User Level Info:");
    console.dir(info, { depth: null });
  })
  .catch((err) => {
    console.error("Failed to fetch profile level:", err);
  });

// {"domain":"app.galxe.com","address":"0xe3bB84c16FcCcF88A3Fe9FE4b7f492c58e944B19","statement":"Sign in with Ethereum to the app.","uri":"https://app.galxe.com","version":"1","chainId":42161,"nonce":"p8nrDsubm0r5r1kLh","issuedAt":"2025-04-11T14:03:54.750Z","expirationTime":"2025-04-18T14:03:54.597Z"}

// payload for Signin
// {
//     "operationName": "SignIn",
//     "variables": {
//         "input": {
//             "address": "0xe3bB84c16FcCcF88A3Fe9FE4b7f492c58e944B19",
//             "signature": "0xb329c3b539a1470d00c396c383386a289eacc5eb5cedcfbf7c980133a64a97623c6219b4562381378234cacad0be88e0d80853129c7e7136ae3dcd829a9b949a1c",
//             "message": "app.galxe.com wants you to sign in with your Ethereum account:\n0xe3bB84c16FcCcF88A3Fe9FE4b7f492c58e944B19\n\nSign in with Ethereum to the app.\n\nURI: https://app.galxe.com\nVersion: 1\nChain ID: 42161\nNonce: p8nrDsubm0r5r1kLh\nIssued At: 2025-04-11T14:03:54.750Z\nExpiration Time: 2025-04-18T14:03:54.597Z",
//             "addressType": "EVM",
//             "publicKey": "42161"
//         }
//     },
//     "query": "mutation SignIn($input: Auth) {\n  signin(input: $input)\n}"
// }

// response for Signin
// {
//     "signin": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJEZXZpY2VJRCI6ImdhLXVzZXItMTc2MzExMzA0Ni4xNzQ0MDgxMDg0IiwiR2FseGVJRCI6IlA1WEh1eVoyV0FEd0x2WmN2V2dXcGciLCJleHAiOjE3NDQ5ODUyMDcsImp0aSI6IjI5MjQ2MjEyNjJjYzQ5ZTU5OTU5ZjZhOThhNWZhMjhmMjcwNDcyYTY3ZDdlNzBkNzI3MjhiODIxYjE0OTBhMTQiLCJBZGRyZXNzIjoiMHhlM2JCODRjMTZGY0NjRjg4QTNGZTlGRTRiN2Y0OTJjNThlOTQ0QjE5IiwiQWRkcmVzc1R5cGUiOjEsIkFjY291bnRVc2VybmFtZSI6IiJ9.npXlowPA8r9wR7jPtC5HPugMZLF4PrjWvqtV3WiQUOs"
// }

// {"domain":"app.galxe.com","address":"0xe3bB84c16FcCcF88A3Fe9FE4b7f492c58e944B19","statement":"Sign in with Ethereum to the app.","uri":"https://app.galxe.com","version":"1","chainId":42161,"nonce":"Zk1d33lFhr7zmbEYM","issuedAt":"2025-04-11T14:17:57.661Z","expirationTime":"2025-04-18T14:17:57.659Z"}
