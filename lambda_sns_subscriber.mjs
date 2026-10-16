import { SNSClient, SubscribeCommand } from "@aws-sdk/client-sns";

const snsClient = new SNSClient({});

export const handler = async (event) => {
  // Extraer el correo y verificar que el usuario esté confirmado
  const userEmail = event.request.userAttributes?.email;
  const topicArn = process.env.SNS_TOPIC_ARN;

  console.log(`Procesando registro post-confirmación para: ${userEmail}`);

  if (userEmail && topicArn) {
    try {
      const command = new SubscribeCommand({
        TopicArn: topicArn,
        Protocol: "email",
        Endpoint: userEmail,
      });

      const response = await snsClient.send(command);
      console.log(`Solicitud de suscripción enviada a SNS. SubscriptionArn/Status: ${response.SubscriptionArn}`);
    } catch (error) {
      // Registrar el error en CloudWatch sin interrumpir el flujo de Cognito
      console.error("Error al suscribir usuario en SNS:", error);
    }
  } else {
    console.warn("No se encontró email o SNS_TOPIC_ARN en el evento/variables de entorno.");
  }

  // OBLIGATORIO: Retornar el evento intacto para que Cognito continúe
  return event;
};
