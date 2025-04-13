require("dotenv").config();
const { ethers } = require("ethers");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

// Constants
const GALXE_API_URL = "https://graphigo.prd.galaxy.eco/query";

/**
 * Create the SIWE (Sign-In With Ethereum) message for authentication
 * @param {string} address - User's wallet address
 * @param {number} chainId - Blockchain chain ID (1 for Ethereum Mainnet, 42161 for Arbitrum)
 * @returns {Object} - SIWE message object
 */
function createSiweMessage(address, chainId = 1) {
  const nonce = generateNonce(12);
  const currentDate = new Date();
  const expirationDate = new Date(currentDate);
  expirationDate.setDate(expirationDate.getDate() + 7); // 7 days expiration

  return {
    domain: "app.galxe.com",
    address: address,
    statement: "Sign in with Ethereum to the app.",
    uri: "https://app.galxe.com",
    version: "1",
    chainId: chainId,
    nonce: nonce,
    issuedAt: currentDate.toISOString(),
    expirationTime: expirationDate.toISOString(),
  };
}

/**
 * Generate a random nonce string
 * @param {number} length - Length of the nonce
 * @returns {string} - Random nonce
 */
function generateNonce(length) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Format the SIWE message for signing
 * @param {Object} siweMsg - SIWE message object
 * @returns {string} - Formatted message for signing
 */
function formatSiweMessage(siweMsg) {
  return `app.galxe.com wants you to sign in with your Ethereum account:
${siweMsg.address}

${siweMsg.statement}

URI: ${siweMsg.uri}
Version: ${siweMsg.version}
Chain ID: ${siweMsg.chainId}
Nonce: ${siweMsg.nonce}
Issued At: ${siweMsg.issuedAt}
Expiration Time: ${siweMsg.expirationTime}`;
}

async function getNotifications(walletAddress) {
  const query = `
    query GetGlobalNotification($address: String!) {
  claimable: Activities(
    req: {addr: $address, activityType: [5], state: [2], first: 1}
  ) {
    list {
      timestamp
      activityType
      state
      __typename
    }
    __typename
  }
  pending: Activities(
    req: {addr: $address, activityType: [4, 5], state: [0], first: 1}
  ) {
    list {
      timestamp
      activityType
      state
      __typename
    }
    __typename
  }
  recent: Activities(
    req: {addr: $address, activityType: [4, 5], state: [1, 4], first: 20}
  ) {
    list {
      timestamp
      activityType
      state
      __typename
    }
    __typename
  }
}
  `;

  const variables = { address: walletAddress };

  try {
    const response = await axios.post(
      GALXE_API_URL,
      { operationName: "GetGlobalNotification", variables, query },
      { headers: { "Content-Type": "application/json" } }
    );

    return response.data.data;
  } catch (error) {
    console.error(
      "Error fetching notifications:",
      error.response?.data || error.message
    );
    throw error;
  }
}

/**
 * Get user token balance
 * @param {string} walletAddress - User's wallet address
 * @returns {Promise<Object>} - User balance
 */
async function getUserBalance(walletAddress) {
  const query = `
    query GetBalance($address: String!) {
      GetBalance(address: $address) {
        token
        ssBalance
        pendingAmount
        __typename
      }
    }
  `;

  const variables = { address: walletAddress };

  try {
    const response = await axios.post(
      GALXE_API_URL,
      { operationName: "GetBalance", variables, query },
      { headers: { "Content-Type": "application/json" } }
    );

    return response.data.data.GetBalance;
  } catch (error) {
    console.error(
      "Error fetching user balance:",
      error.response?.data || error.message
    );
    throw error;
  }
}

async function getTotalAndYesterdayProfit(walletAddress) {
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

  const variables = { address: walletAddress };

  try {
    const response = await axios.post(
      GALXE_API_URL,
      { operationName: "GetTotalAndYesterdayProfit", variables, query },
      { headers: { "Content-Type": "application/json" } }
    );

    return response.data.data;
  } catch (error) {
    console.error(
      "Error fetching profit information:",
      error.response?.data || error.message
    );
    throw error;
  }
}

/**
 * Get all campaign quests
 * @param {string} walletAddress - User's wallet address
 * @param {string} jwtToken - Authentication token
 * @returns {Promise<Object>} - Campaign quests
 */
async function getAllCampaignQuests(walletAddress, jwtToken) {
  const query = `
    query CampaignList($input: ListCampaignInput!, $address: String!) {
      campaigns(input: $input) {
        pageInfo {
          endCursor
          hasNextPage
        }
        list {
          id
          numberID
          name
          thumbnail
          description
          status
          startTime
          endTime
          chain
          rewardName
        }
      }
    }
  `;

  const variables = {
    address: walletAddress,
    input: {
      listType: "Trending",
      listTrendingWithoutFilter: true,
      first: 20,
      after: "-1",
    },
  };

  try {
    const response = await axios.post(
      GALXE_API_URL,
      { operationName: "CampaignList", variables, query },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: jwtToken,
          platform: "web",
          origin: "https://app.galxe.com",
        },
      }
    );

    return response.data.data.campaigns;
  } catch (error) {
    console.error(
      "Error fetching campaign quests:",
      error.response?.data || error.message
    );
    throw error;
  }
}

/**
 * Get Participation Info for a Quest
 * @param {string} campaignId - Campaign ID
 * @param {string} walletAddress - User's wallet address
 * @param {string} jwtToken - Authentication token
 * @returns {Promise<Object>} - Participation information
 */
async function getParticipationInfo(campaignId, walletAddress, jwtToken) {
  const query = `
    query QuestClaimSection($id: ID!, $address: String!, $withAddress: Boolean!, $isParent: Boolean = false) {
      campaign(id: $id) {
        id
        name
        description
        status
        startTime
        endTime
        claimEndTime
        rewardType
        loyaltyPoints
        taskConfig(address: $address) {
          rewardConfigs {
            id
            eligible
            rewards {
              rewardType
              rewardCount
              rewardVal
            }
          }
        }
      }
    }
  `;

  const variables = {
    id: campaignId,
    address: walletAddress,
    withAddress: true,
    isParent: false,
  };

  try {
    const response = await axios.post(
      GALXE_API_URL,
      { operationName: "QuestClaimSection", variables, query },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: jwtToken,
        },
      }
    );

    return response.data.data.campaign;
  } catch (error) {
    console.error(
      "Error fetching participation info:",
      error.response?.data || error.message
    );
    throw error;
  }
}

/**
 * Estimate Quest Cost Detail
 * @param {number} questId - Quest ID
 * @param {number} mintCount - Number of mints
 * @param {string} chain - Blockchain chain name
 * @param {string} jwtToken - Authentication token
 * @returns {Promise<Object>} - Cost estimation details
 */
async function estimateQuestCostDetail(questId, mintCount, chain, jwtToken) {
  const query = `
    query estimateQuestCostDetail($input: EstimateQuestCostDetailInput!) {
      estimateQuestCostDetail(input: $input) {
        totalCost { amount, usd, chain }
        totalClaimFee { amount, usd, chain }
        totalServiceFee { amount, usd, chain }
        transactionFee { claimFee { amount, usd }, gasFee { amount, usd }, serviceFee { amount, usd }, chain, mintType }
      }
    }
  `;

  const variables = {
    input: {
      questId,
      mints: [{ mintCount, mintType: "Points", chain }],
    },
  };

  try {
    const response = await axios.post(
      GALXE_API_URL,
      { operationName: "estimateQuestCostDetail", variables, query },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: jwtToken,
        },
      }
    );

    return response.data.data.estimateQuestCostDetail;
  } catch (error) {
    console.error(
      "Error estimating quest cost detail:",
      error.response?.data || error.message
    );
    throw error;
  }
}

/**
 * Login to Galxe using MetaMask
 * @param {ethers.Wallet|ethers.Signer} signer - Ethereum wallet or signer
 * @param {number} chainId - Blockchain chain ID
 * @returns {Promise<string>} - JWT token for authenticated requests
 */
async function loginWithMetaMask(signer, chainId = 1) {
  try {
    const address = await signer.getAddress();
    console.log(`Logging in with address: ${address}`);

    // Create SIWE message
    const siweMsg = createSiweMessage(address, chainId);
    const message = formatSiweMessage(siweMsg);

    // Sign the message
    console.log("Signing authentication message...");
    const signature = await signer.signMessage(message);

    // Send the signin mutation
    const signinMutation = `
      mutation SignIn($input: Auth) {
        signin(input: $input)
      }
    `;

    const variables = {
      input: {
        address: address,
        signature: signature,
        message: message,
        addressType: "EVM",
        publicKey: chainId.toString(),
      },
    };

    console.log("Sending signin request to Galxe...");
    const response = await axios.post(
      GALXE_API_URL,
      {
        operationName: "SignIn",
        variables: variables,
        query: signinMutation,
      },
      {
        headers: {
          "Content-Type": "application/json",
          platform: "web",
          origin: "https://app.galxe.com",
          "device-id": `ga-user-${Date.now()}.${Math.floor(
            Math.random() * 1000000000
          )}`,
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
        },
      }
    );

    const jwtToken = response.data.data.signin;
    console.log("Login successful!");

    return jwtToken;
  } catch (error) {
    console.error("Login failed:", error.response?.data || error.message);
    throw error;
  }
}

/**
 * Create a new account on Galxe
 * @param {string} walletAddress - User's wallet address
 * @param {string} username - Desired username
 * @param {string} jwtToken - Authentication token
 * @returns {Promise<Object>} - Account creation response
 */
async function createAccount(walletAddress, username, jwtToken) {
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
          Authorization: jwtToken,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error(
      "Error creating account:",
      error.response?.data || error.message
    );
    throw error;
  }
}

/**
 * Get user profile level information
 * @param {string} walletAddress - User's wallet address
 * @param {string} jwtToken - Authentication token
 * @returns {Promise<Object>} - User level information
 */
async function checkProfileLevel(walletAddress, jwtToken) {
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
          Authorization: jwtToken,
          platform: "web",
          origin: "https://app.galxe.com",
        },
      }
    );

    return response.data.data.addressInfo;
  } catch (error) {
    console.error(
      "Error checking profile:",
      error.response?.data || error.message
    );
    throw error;
  }
}

async function getCampaigns(
  address,
  jwtToken,
  listType = "Trending",
  first = 20
) {
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
          taskConfig(address: $address) {
            participateCondition {
              eligible
              conditions {
                attrFormula
                eligible
              }
            }
          }
        }
      }
    }
  `;

  const variables = {
    address,
    input: {
      listType: listType,
      listTrendingWithoutFilter: true,
      first: first,
      after: "-1",
    },
  };

  try {
    const response = await axios.post(
      GALXE_API_URL,
      { query, variables, operationName: "CampaignList" },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: jwtToken,
          platform: "web",
          origin: "https://app.galxe.com",
        },
      }
    );

    return response.data.data.campaigns;
  } catch (error) {
    console.error(
      "Error fetching campaigns:",
      error.response?.data || error.message
    );
    throw error;
  }
}

/**
 * Get campaign details by ID
 * @param {string} campaignId - Campaign ID
 * @param {string} address - User's wallet address
 * @param {string} jwtToken - Authentication token
 * @returns {Promise<Object>} - Campaign details with task conditions
 */
async function getCampaignDetails(campaignId, address, jwtToken) {
  const query = `
    query QuestCredList($id: ID!, $address: String!) {
      campaign(id: $id) {
        id
        name
        description
        thumbnail
        rewardName
        chain
        status
        startTime
        endTime
        taskConfig(address: $address) {
          participateCondition {
            eligible
            conditions {
              attrFormula
              eligible
              description
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

  const variables = { id: campaignId, address };

  try {
    const response = await axios.post(
      GALXE_API_URL,
      { query, variables, operationName: "QuestCredList" },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: jwtToken,
          Origin: "https://app.galxe.com",
          Platform: "web",
        },
      }
    );

    return response.data.data.campaign;
  } catch (error) {
    console.error(
      "Error fetching campaign details:",
      error.response?.data || error.message
    );
    throw error;
  }
}

/**
 * Get List of User Tokens
 * @param {number} afterId - Cursor after which to retrieve tokens
 * @param {number} limit - Number of tokens to retrieve
 * @param {string} jwtToken - Authentication token
 * @returns {Promise<Object>} - List of user tokens
 */
async function getListUserTokens(afterId, limit, jwtToken) {
  const query = `
    query UserTokenList($request: ListUserTokensRequest!) {
      listUserTokens(request: $request) {
        totalCount
        pageInfo {
          startCursor
          endCursor
          hasNextPage
          hasPreviousPage
        }
        list {
          id
          chain
          tokenAmount
          tokenDetail {
            id
            chain
            tokenDecimal
            tokenLogo
            tokenSymbol
            tokenAddress
          }
        }
      }
    }
  `;

  const variables = { request: { afterId, limit } };

  try {
    const response = await axios.post(
      GALXE_API_URL,
      { operationName: "UserTokenList", variables, query },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: jwtToken,
        },
      }
    );

    return response.data.data.listUserTokens;
  } catch (error) {
    console.error(
      "Error fetching user tokens:",
      error.response?.data || error.message
    );
    throw error;
  }
}

async function renewToken(oldToken) {
  const query = `
    mutation RenewToken($oldToken: String!) {
      renewToken(oldToken: $oldToken)
    }
  `;

  const variables = { oldToken };

  try {
    const response = await axios.post(
      GALXE_API_URL,
      { operationName: "RenewToken", variables, query },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: oldToken,
        },
      }
    );

    return response.data.data.renewToken;
  } catch (error) {
    console.error(
      "Error renewing token:",
      error.response?.data || error.message
    );
    throw error;
  }
}

/**
 * Main function to demonstrate the flow
 */
async function main() {
  try {
    // Set up wallet from private key
    // const PRIVATE_KEY = process.env.PRIVATE_KEY;
    const PRIVATE_KEY =
      "412079fb78537977c310eef861c2eb399478ea0a8ec80b4afd83617175cea919";
    // if (!PRIVATE_KEY) {
    //   throw new Error("Please set your PRIVATE_KEY in the .env file");
    // }

    // // Connect to Ethereum provider
    const provider = new ethers.providers.JsonRpcProvider(
      process.env.RPC_URL || "https://eth.llamarpc.com"
    );
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    // const walletAddress = await wallet.getAddress();
    const walletAddress = "0x48b65493F192d6b06E31483a9230595f44bC696E";
    console.log(`Using wallet address: ${walletAddress}`);

    // Login to Galxe
    const jwtToken = await loginWithMetaMask(wallet);
    console.log(`JWT Token: ${jwtToken}`);

    // Check if user profile exists, if not create one
    const profileInfo = await checkProfileLevel(walletAddress, jwtToken);
    if (!profileInfo) {
      console.log("Creating new account...");
      const username = `user_${uuidv4().substring(0, 8)}`;
      await createAccount(walletAddress, username, jwtToken);
      console.log(`New account created with username: ${username}`);
    } else {
      console.log("User profile found:");
      console.log(`Level: ${profileInfo.userLevel.level.name}`);
      console.log(`Experience: ${profileInfo.userLevel.exp}`);
      console.log(`Gold: ${profileInfo.userLevel.gold}`);
    }

    // Get available campaigns
    console.log("Fetching available campaigns...");
    const campaigns = await getCampaigns(walletAddress, jwtToken);
    console.log(`Found ${campaigns.list.length} campaigns`);

    // Display eligible campaigns
    const eligibleCampaigns = campaigns.list.filter(
      (campaign) => campaign.taskConfig?.participateCondition?.eligible
    );

    console.log(`You are eligible for ${eligibleCampaigns.length} campaigns:`);
    eligibleCampaigns.forEach((campaign, index) => {
      console.log(`${index + 1}. ${campaign.name} (ID: ${campaign.id})`);
      console.log(`   Chain: ${campaign.chain}`);
      console.log(`   Reward: ${campaign.rewardName}`);
      console.log(
        `   Ends: ${new Date(campaign.endTime * 1000).toLocaleString()}`
      );
      console.log("---");
    });

    // Get details for the first eligible campaign if any
    if (eligibleCampaigns.length > 0) {
      const firstCampaign = eligibleCampaigns[0];
      console.log(`Getting details for campaign: ${firstCampaign.name}`);
      const campaignDetails = await getCampaignDetails(
        firstCampaign.id,
        walletAddress,
        jwtToken
      );
      console.log(
        "Campaign details:",
        JSON.stringify(campaignDetails, null, 2)
      );
    }

    // Get notifications
    console.log("Fetching notifications...");
    const notifications = await getNotifications(walletAddress, jwtToken);
    console.log(`Found ${notifications.list.length} notifications`);

    // Get user balance
    console.log("Fetching user balance...");
    const userBalance = await getUserBalance(walletAddress, jwtToken);
    console.log(`User balance: ${userBalance}`);

    // Get total and yesterday profit
    console.log("Fetching total and yesterday profit...");
    const totalAndYesterdayProfit = await getTotalAndYesterdayProfit(
      walletAddress
    );
    console.log("Total and yesterday profit:", totalAndYesterdayProfit);

    // Get User Token List
    console.log("Fetching user token list...");
    const userTokenList = await getListUserTokens(0, 10, jwtToken);
    console.log("User token list:", userTokenList);

    // Get participation info for the first campaign quest
  } catch (error) {
    console.error("Error in main function:", error);
  }
}

// Execute the main function if this script is run directly
if (require.main === module) {
  main();
}

// Export the newly added functions
module.exports = {
  loginWithMetaMask,
  createAccount,
  checkProfileLevel,
  getCampaigns,
  getCampaignDetails,
  getNotifications,
  getUserBalance,
  getAllCampaignQuests,
};
