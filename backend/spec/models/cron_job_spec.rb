require 'rails_helper'

RSpec.describe CronJob, type: :model do
  # ── Validations ─────────────────────────────────────────────────────────────
  it { is_expected.to validate_presence_of(:name) }
  it { is_expected.to validate_presence_of(:cron_expression) }
  it { is_expected.to validate_presence_of(:command) }
  it { is_expected.to validate_inclusion_of(:status).in_array(CronJob::STATUSES) }

  # ── Associations ─────────────────────────────────────────────────────────────
  it { is_expected.to belong_to(:task).optional }
  it { is_expected.to belong_to(:project).optional }
  it { is_expected.to have_many(:calendar_events).dependent(:nullify) }

  # ── Scopes ─────────────────────────────────────────────────────────────────
  describe ".active" do
    it "returns only enabled cron jobs" do
      enabled  = create(:cron_job, enabled: true)
      disabled = create(:cron_job, :disabled)

      result = CronJob.active
      expect(result).to include(enabled)
      expect(result).not_to include(disabled)
    end
  end

  describe ".enabled" do
    it "returns only enabled cron jobs" do
      enabled  = create(:cron_job, enabled: true)
      disabled = create(:cron_job, :disabled)

      result = CronJob.enabled
      expect(result).to include(enabled)
      expect(result).not_to include(disabled)
    end
  end

  # ── Defaults ───────────────────────────────────────────────────────────────
  describe "defaults" do
    it "sets failure_count to 0" do
      cron_job = create(:cron_job)
      expect(cron_job.failure_count).to eq(0)
    end

    it "sets enabled to true by default" do
      cron_job = create(:cron_job)
      expect(cron_job.enabled).to be true
    end
  end
end
