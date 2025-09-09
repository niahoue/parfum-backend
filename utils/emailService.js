import dotenv from 'dotenv'
import nodemailer from 'nodemailer';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT, 10),
  secure: process.env.EMAIL_PORT === '465', // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  logger: process.env.NODE_ENV === 'development',
  debug: process.env.NODE_ENV === 'development',
  // Ajout de la configuration pour Gmail
  service: 'gmail',
  tls: {
    rejectUnauthorized: false
  }
});

// Vérification de la configuration au démarrage
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Erreur de configuration SMTP:', error);
  } else {
    console.log('✅ Serveur SMTP prêt pour l\'envoi d\'emails');
  }
});

/**
 * Envoie un email de confirmation de commande
 * @param {object} order - L'objet de commande
 */
export const sendOrderConfirmationEmail = async (order) => {
  const mailOptions = {
    from: `"Fragrance de Mumu" <${process.env.EMAIL_FROM}>`,
    to: order.userEmail,
    subject: `Confirmation de commande #${order._id} - Fragrance de Mumu`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #9333ea;">Merci pour votre commande chez Fragrance de Mumu!</h1>
        <p>Votre commande #${order._id} a été confirmée et est en cours de traitement.</p>
        <h2>Détails de la commande:</h2>
        <ul>
          ${order.orderItems.map(item => `<li>${item.name} x ${item.qty} = ${item.price} FCFA</li>`).join('')}
        </ul>
        <p><strong>Total: ${order.totalPrice} FCFA</strong></p>
        <p>Nous vous tiendrons informé de l'expédition de votre commande.</p>
        <p>L'équipe Fragrance de Mumu.</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email de confirmation envoyé à ${order.userEmail}`);
    console.log('Message ID:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi de l\'email de confirmation:', error);
    throw error;
  }
};

/**
 * Envoie un email de réinitialisation de mot de passe
 * @param {object} user - L'objet utilisateur
 * @param {string} resetUrl - Le lien de réinitialisation du mot de passe
 */
export const sendResetPasswordEmail = async (user, resetUrl) => {
  console.log(`📧 Tentative d'envoi d'email de réinitialisation à: ${user.email}`);
  console.log(`🔗 URL de réinitialisation: ${resetUrl}`);

  const mailOptions = {
    from: `"Fragrance de Mumu" <${process.env.EMAIL_FROM}>`,
    to: user.email,
    subject: 'Réinitialisation de mot de passe - Fragrance de Mumu',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #9333ea; text-align: center;">Réinitialisation de votre mot de passe</h1>
        <p>Bonjour <strong>${user.name}</strong>,</p>
        <p>Vous recevez cet e-mail car vous avez demandé la réinitialisation de votre mot de passe sur Fragrance de Mumu.</p>
        <p>Veuillez cliquer sur le bouton ci-dessous pour réinitialiser votre mot de passe :</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" 
             style="background-color: #9333ea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
            Réinitialiser mon mot de passe
          </a>
        </div>
        <p><strong>⚠️ Ce lien expirera dans 10 minutes.</strong></p>
        <p>Si vous n'êtes pas à l'origine de cette demande, veuillez ignorer cet e-mail.</p>
        <hr style="margin: 30px 0;">
        <p style="text-align: center; color: #666; font-size: 14px;">
          L'équipe Fragrance de Mumu<br>
          <em>Votre parfumerie en ligne de confiance</em>
        </p>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return { 
      success: true, 
      messageId: info.messageId,
      response: info.response 
    };
  } catch (error) {
    console.error('❌ Erreur détaillée lors de l\'envoi de l\'email:', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode
    });
    
    // Relancer l'erreur avec plus de détails
    throw new Error(`Échec de l'envoi de l'email: ${error.message}`);
  }
};

/**
 * Envoie un email lorsqu'un visiteur soumet le formulaire de contact
 * @param {object} message - Les infos du formulaire { name, email, subject, message }
 */
export const sendContactEmail = async (message) => {
  const mailOptions = {
    from: `"Fragrance de Mumu - Contact" <${process.env.EMAIL_FROM}>`,
    to: process.env.ADMIN_EMAIL || process.env.EMAIL_FROM, // l'admin reçoit le message
    replyTo: message.email, // permet de répondre directement au visiteur
    subject: `📩 Nouveau message de contact: ${message.subject}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <h2 style="color:#9333ea;">Nouveau message reçu via le site</h2>
        <p><strong>Nom:</strong> ${message.name}</p>
        <p><strong>Email:</strong> ${message.email}</p>
        <p><strong>Sujet:</strong> ${message.subject}</p>
        <p><strong>Message:</strong></p>
        <p style="background:#f9f9f9; padding:10px; border-radius:5px;">${message.message}</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email de contact envoyé à l'admin (${process.env.EMAIL_USER})`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Erreur lors de l'envoi de l'email de contact:", error);
    throw error;
  }
};
