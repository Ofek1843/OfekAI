// Deploy this as Cloud Function: gcloud functions deploy sendActivationEmail --runtime nodejs18 --trigger-resource users --trigger-event providers/cloud.firestore/eventTypes/document.onCreate

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();
const db = admin.firestore();

// Configure email (use your SMTP or SendGrid)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

exports.sendActivationEmail = functions.firestore
  .document("users/{userId}")
  .onCreate(async (snap, context) => {
    const userId = context.params.userId;
    const user = snap.data();
    const email = user.email || "";
    if (!email) return;

    // Wait 24 hours
    await new Promise(r => setTimeout(r, 24 * 60 * 60 * 1000));

    try {
      // Check if user created a plan
      const plansSnap = await db.collection(`users/${userId}/workoutPlans`).limit(1).get();
      if (!plansSnap.empty) return; // User already has a plan

      const mailOptions = {
        from: "fuelphysiquesupport@gmail.com",
        to: email,
        subject: "Your personalized plan is ready — build it in 2 minutes",
        html: `
          <h2>Welcome to FuelPhysique!</h2>
          <p>You've taken the first step. Now let's create your personalized workout plan.</p>
          <p>It takes just 2 minutes — answer a few questions about your goals and equipment, and we'll generate a full program tailored to you.</p>
          <a href="https://fuelphysique.com/workout-builder.html" style="display:inline-block;padding:12px 28px;background:#22c55e;color:white;border-radius:8px;text-decoration:none;font-weight:bold">Create Your Plan</a>
          <p style="margin-top:40px;font-size:12px;color:#666">Questions? Reply to this email or visit <a href="https://fuelphysique.com/contact.html">our contact page</a>.</p>
        `
      };

      await transporter.sendMail(mailOptions);
      console.log(`Activation email sent to ${email}`);
    } catch (error) {
      console.error("Error sending email:", error);
    }
  });
