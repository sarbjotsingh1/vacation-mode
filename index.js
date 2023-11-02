// Import the required modules
const { google } = require("googleapis");
const {
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI,
  REFRESH_TOKEN,
} = require("./credentials");

// Create an OAuth2 client and set its credentials
const oAuth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

// Create a set to keep track of users we've replied to
const repliedUsers = new Set();

// Asynchronous function to check emails and send replies
async function checkEmailAndSendReplies() {
  try {
    // Create a Gmail client
    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

    // List unread messages
    const res = await gmail.users.messages.list({
      userId: "me",
      q: "is:unread",
    });

    const messages = res.data.messages;

    // Iterate through unread messages
    for (const message of messages) {
      // Get the full email details
      const email = await gmail.users.messages.get({
        userId: "me",
        id: message.id,
      });

      // Extract sender, recipient, and subject information
      const from = email.data.payload.headers.find(
        (header) => header.name === "From"
      );
      const toHeader = email.data.payload.headers.find(
        (header) => header.name === "To"
      );
      const subject = email.data.payload.headers.find(
        (header) => header.name === "Subject"
      );

      const From = from.value;
      const toEmail = toHeader.value;
      const Subject = subject.value;

      // Log email details
      console.log("Email came from:", From);
      console.log("To Email:", toEmail);

      // Check if we've already replied to this user
      if (repliedUsers.has(From)) {
        console.log("Already replied to:", From);
        continue;
      }

      // Get the email thread
      const thread = await gmail.users.threads.get({
        userId: "me",
        id: message.threadId,
      });

      // Get the replies in the thread
      const replies = thread.data.messages.slice(1);

      // If there are no replies, send a reply and label the email
      if (replies.length === 0) {
        await gmail.users.messages.send({
          userId: "me",
          requestBody: {
            raw: await createReplyRaw(toEmail, From, Subject),
          },
        });

        // Create a label for the email
        const labelName = "Vacation Mode On";
        const labelId = await createLabelIfNeeded(gmail, labelName);

        // Add the label to the email
        await gmail.users.messages.modify({
          userId: "me",
          id: message.id,
          requestBody: { addLabelIds: [labelId] },
        });

        console.log("Sent reply to email:", From);
        repliedUsers.add(From);
      }
    }
  } catch (error) {
    console.error("Error occurred:", error);
  }
}

// Function to create the raw email content for a reply
async function createReplyRaw(from, to, subject) {
  const emailContent = `From: ${from}\nTo:${to}\nSubject: ${subject}\n\n Thank you for your message. I am on break, but will respond as soon as possible...`;
  const base64EncodedEmail = Buffer.from(emailContent)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return base64EncodedEmail;
}

// Function to create a Gmail label if it doesn't exist
async function createLabelIfNeeded(gmail, labelName) {
  const res = await gmail.users.labels.list({ userId: "me" });
  const labels = res.data.labels;

  const existingLabel = labels.find((label) => label.name === labelName);
  if (existingLabel) {
    return existingLabel.id;
  }

  const newLabel = await gmail.users.labels.create({
    userId: "me",
    requestBody: {
      name: labelName,
      labelListVisibility: "labelShow",
      messageListVisibility: "show",
    },
  });
  return newLabel.data.id;
}

// Function to get a random interval in milliseconds
function getRandomInterval(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

// Main function to set up the OAuth client and periodically check for emails
async function main() {
  const oAuth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
  );
  oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

  // Set up an interval to check emails and send replies
  setInterval(checkEmailAndSendReplies, getRandomInterval(45, 120) * 1000);
}

main();
