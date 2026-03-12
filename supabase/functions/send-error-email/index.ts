import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

const SMTP_HOSTNAME = "smtp.gmail.com";
const SMTP_PORT = 465;
// Read these from environment variables securely set in Supabase
const SMTP_USER = Deno.env.get("GMAIL_USER") || "chlgnstj1@gmail.com";
const SMTP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD"); 

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const payload = await req.json();
    
    // Webhooks typically send the new row in `record` for INSERT events
    const record = payload.record;
    
    if (!record) {
      throw new Error("No record found in payload");
    }

    const { email, content, attachment_url, created_at } = record;
    
    if (!SMTP_PASSWORD) {
       throw new Error("SMTP Password not configured.");
    }

    const client = new SmtpClient();

    await client.connectTLS({
      hostname: SMTP_HOSTNAME,
      port: SMTP_PORT,
      username: SMTP_USER,
      password: SMTP_PASSWORD,
    });

    const attachmentInfo = attachment_url 
        ? `\n\n첨부파일 확인: ${attachment_url}` 
        : `\n\n(첨부 파일 없음)`;

    await client.send({
      from: SMTP_USER, // The authenticated sender 
      to: "chlgnstj1@gmail.com", // Send to self
      subject: `[오류 제보] 새로운 오류가 접수되었습니다.`,
      content: `
새로운 오류 제보가 접수되었습니다.

- 제보자: ${email || '미상'}
- 접수 시간: ${new Date(created_at).toLocaleString('ko-KR')}

[오류 내용]
${content}
${attachmentInfo}
      `,
    });

    await client.close();

    return new Response(JSON.stringify({ success: true, message: "Email sent successfully" }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error sending email:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
