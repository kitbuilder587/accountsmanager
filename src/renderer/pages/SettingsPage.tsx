export function SettingsPage() {
  return (
    <div className="settings-page">
      <div className="panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Configuration</p>
            <h2>Settings</h2>
          </div>
        </div>

        <div className="settings-sections">
          <section className="settings-section">
            <h3>Telegram Bot</h3>
            <p className="settings-hint">
              Configure TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in your .env file.
              The bot receives Instagram reel links and adds them to the pipeline.
            </p>
          </section>

          <section className="settings-section">
            <h3>AI / OCR</h3>
            <p className="settings-hint">
              Configure OPENAI_API_KEY in your .env file for text generation and classification.
              OCR uses Tesseract locally.
            </p>
          </section>

          <section className="settings-section">
            <h3>Publishing</h3>
            <p className="settings-hint">
              Publishing uses browser automation through managed account profiles.
              Ensure accounts are logged in via the Accounts tab before scheduling jobs.
            </p>
          </section>

          <section className="settings-section">
            <h3>Environment Variables</h3>
            <div className="settings-env-list">
              <code>ADMIN_PASSWORD</code> — Password for web UI access (20+ chars recommended)
              <br />
              <code>JWT_SECRET</code> — Secret for JWT tokens (auto-generated if not set)
              <br />
              <code>TELEGRAM_BOT_TOKEN</code> — Telegram bot token
              <br />
              <code>TELEGRAM_CHAT_ID</code> — Allowed Telegram chat ID
              <br />
              <code>OPENAI_API_KEY</code> — OpenAI API key for text generation
              <br />
              <code>PORT</code> — Server port (default: 3001)
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
