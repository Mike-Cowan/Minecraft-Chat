const fs = require("fs/promises");
const { Client } = require("discord.js");
const { Rcon } = require("rcon-client");
const { watchFile } = require("node:fs");

require("dotenv").config();
const client = new Client({
  intents: ["GUILDS", "GUILD_MESSAGES", "DIRECT_MESSAGES"],
});
let rcon;
let channel;
let chatLogs = [];

const initRCON = async () => {
  rcon = await Rcon.connect({
    host: `${process.env.RCONHOST}`,
    port: `${process.env.RCONPORT}`,
    password: `${process.env.RCONPASSWORD}`,
  });
  return;
};

const checkHistory = async (logToCheck) => {
  console.log("checking history");
  let messageToCheck = `${logToCheck.hours}:${logToCheck.minutes}:${logToCheck.seconds} ${logToCheck.userName}: ${logToCheck.sentence}`;

  let count = 0;
  if (channel === undefined) {
    console.log("channel is undefined");
    return true;
  }
  let messages = await channel.messages.fetch({ limit: 100 });
  if (!messages) {
    return true;
  }
  console.log(`Received ${messages.size} messages`);
  messages.forEach((message) => {
    if (message.content === messageToCheck) {
      count++;
    }
  });

  if (count === 0) {
    console.log("UNIQUE");
    return false;
  } else {
    console.log("FOUND");
    return true;
  }
};

client.on("ready", async () => {
  await initRCON();

  channel = client.channels.cache.get(`${process.env.CHANNELID}`);
  console.log(
    "Ready to begin! Serving in " +
      JSON.stringify(client.channels) +
      " channels"
  );
  await checkLog();
  LogsToDiscord();

  watchFile(`${process.env.LOGPATH}`, async (event, filename) => {
    await checkLog();
    LogsToDiscord();
  });
});

client.on("messageCreate", async (msg) => {
  if (msg.author.bot === false) {
    let responses = await Promise.all([
      rcon.send(`say ${msg.member.user.tag}: ${msg.content}`),
    ]);

    for (response of responses) {
      console.log(response);
    }
  }
});

client.on("disconnected", function () {
  // alert the console
  console.log("Disconnected!");

  // exit node.js with an error
  rcon.end();
  process.exit(1);
});

const parseLine = (line) => {
  let userName = "";
  let sentence = "";
  let time = "";
  let hours;
  let minutes;
  let seconds;
  if (line.includes("<") && !line.includes("Rcon")) {
    parsedLine = line.split(/<|>/);

    time = parsedLine[0].substring(
      parsedLine[0].indexOf("[") + 1,
      parsedLine[0].indexOf("]")
    );
    time = time.split(":");
    hours = time[0];
    minutes = time[1];
    seconds = time[2];
    userName = parsedLine[1];
    sentence = parsedLine[2];
    sentence = sentence.trimStart();
    sentence = sentence.trimEnd();
  }
  const chatLog = {
    userName,
    sentence,
    hours,
    minutes,
    seconds,
  };
  if (chatLog.userName !== "") {
    return chatLog;
  }
};

const checkLog = async () => {
  try {
    chatLogs = [];

    const data = await fs.readFile(`${process.env.LOGPATH}`, {
      encoding: "utf8",
    });
    data.split(/\r?\n/).forEach((line) => {
      let parsedLine = parseLine(line);
      if (parsedLine !== undefined) {
        chatLogs.push(parsedLine);
      }
    });
    console.log(chatLogs);
    return true;
  } catch (err) {
    console.log(err);
    return false;
  }
};

const LogsToDiscord = async () => {
  console.log("sending logs to discord");
  chatLogs.map(async (log) => {
    let historyCheck = await checkHistory(log);
    if (historyCheck === false) {
      console.log("successfully sent to discord");
      channel.send({
        content: `${log.hours}:${log.minutes}:${log.seconds} ${log.userName}: ${log.sentence}`,
      });
      //send to discord
    } else {
      console.log("no logs to send");
    }
  });
};
client.login(`${process.env.DISCORDBOTTOKEN}`);
