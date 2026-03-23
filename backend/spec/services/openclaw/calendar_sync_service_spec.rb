require "rails_helper"

RSpec.describe Openclaw::CalendarSyncService do
  include ActiveSupport::Testing::TimeHelpers

  subject(:service) { described_class.new }

  let(:gateway) { instance_double(Openclaw::GatewayClient) }

  before do
    allow(Openclaw::GatewayClient).to receive(:new).and_return(gateway)
  end

  # -- Sample gateway payloads ------------------------------------------------

  let(:gateway_jobs) do
    [
      {
        "id"              => "gw-job-1",
        "name"            => "Nightly backup",
        "cron_expression" => "0 3 * * *",
        "command"         => "backup.sh",
        "enabled"         => true,
        "status"          => "active",
        "last_run_at"     => 1.hour.ago.iso8601,
        "next_run_at"     => 1.day.from_now.iso8601
      },
      {
        "id"              => "gw-job-2",
        "name"            => "Health ping",
        "cron_expression" => "*/5 * * * *",
        "command"         => "ping.sh",
        "enabled"         => true,
        "status"          => "idle",
        "last_run_at"     => 10.minutes.ago.iso8601,
        "next_run_at"     => 5.minutes.from_now.iso8601
      }
    ]
  end

  # ---------------------------------------------------------------------------
  # Context: gateway responds with schedule data
  # ---------------------------------------------------------------------------
  context "when gateway responds with schedule data via schedule.list" do
    before do
      allow(gateway).to receive(:rpc)
        .with("schedule.list")
        .and_return({ "jobs" => gateway_jobs })
    end

    it "creates CronJob records from gateway data" do
      expect { service.call }.to change(CronJob, :count).by(2)

      cj = CronJob.find_by(gateway_reference: "gw-job-1")
      expect(cj).to be_present
      expect(cj.name).to eq("Nightly backup")
      expect(cj.cron_expression).to eq("0 3 * * *")
      expect(cj.sync_source).to eq("gateway")
      expect(cj.synced_at).to be_within(5.seconds).of(Time.current)
    end

    it "creates CalendarEvent records for upcoming executions" do
      expect { service.call }.to change(CalendarEvent, :count).by(2)

      event = CalendarEvent.find_by(gateway_reference: "gw-job-2")
      expect(event).to be_present
      expect(event.source).to eq("cron_job")
      expect(event.status).to eq("scheduled")
      expect(event.cron_job).to eq(CronJob.find_by(gateway_reference: "gw-job-2"))
    end

    it "returns correct result struct counts" do
      result = service.call

      expect(result[:synced_cron_jobs]).to eq(2)
      expect(result[:synced_events]).to eq(2)
      expect(result[:gateway_available]).to be(true)
      expect(result[:gateway_supports_schedule]).to be(true)
      expect(result[:errors]).to be_empty
      expect(result[:synced_at]).to be_within(5.seconds).of(Time.current)
    end
  end

  # ---------------------------------------------------------------------------
  # Context: gateway responds via cron.list (second fallback)
  # ---------------------------------------------------------------------------
  context "when schedule.list fails but cron.list succeeds" do
    before do
      allow(gateway).to receive(:rpc)
        .with("schedule.list")
        .and_raise(Openclaw::GatewayError.new("OpenClaw RPC error (METHOD_NOT_FOUND): unknown method"))
      allow(gateway).to receive(:rpc)
        .with("cron.list")
        .and_return({ "jobs" => gateway_jobs })
    end

    it "falls back to cron.list and syncs data" do
      result = service.call

      expect(result[:gateway_available]).to be(true)
      expect(result[:gateway_supports_schedule]).to be(true)
      expect(result[:synced_cron_jobs]).to eq(2)
    end
  end

  # ---------------------------------------------------------------------------
  # Context: gateway returns an empty list
  # ---------------------------------------------------------------------------
  context "when gateway responds with an empty schedule" do
    before do
      allow(gateway).to receive(:rpc)
        .with("schedule.list")
        .and_return({ "jobs" => [] })
    end

    it "returns zero counts with gateway_available true" do
      result = service.call

      expect(result[:synced_cron_jobs]).to eq(0)
      expect(result[:synced_events]).to eq(0)
      expect(result[:gateway_available]).to be(true)
      expect(result[:gateway_supports_schedule]).to be(true)
    end
  end

  # ---------------------------------------------------------------------------
  # Context: all RPC methods fail with GatewayError (connection-level)
  # ---------------------------------------------------------------------------
  context "when all schedule RPCs fail with a connection error" do
    before do
      allow(gateway).to receive(:rpc)
        .and_raise(Openclaw::GatewayError.new("OpenClaw gateway connection failed: Connection refused"))
    end

    it "returns gateway_available false and does not raise" do
      result = service.call

      expect(result[:gateway_available]).to be(false)
      expect(result[:gateway_supports_schedule]).to be(false)
      expect(result[:synced_cron_jobs]).to eq(0)
      expect(result[:synced_events]).to eq(0)
      expect(result[:errors]).not_to be_empty
    end

    it "emits a calendar_sync_failed event" do
      expect(EventStore).to receive(:emit).with(hash_including(
        type:    "calendar_sync_failed",
        message: a_string_including("could not reach")
      ))

      service.call
    end

    it "does not mark existing records as failed" do
      existing = create(:cron_job, gateway_reference: "gw-existing", status: "active")

      service.call

      expect(existing.reload.status).to eq("active")
    end
  end

  # ---------------------------------------------------------------------------
  # Context: all RPCs fail with method-not-found (gateway reachable but no schedule support)
  # ---------------------------------------------------------------------------
  context "when all RPCs return method-not-found errors" do
    before do
      allow(gateway).to receive(:rpc)
        .and_raise(Openclaw::GatewayError.new("OpenClaw RPC error (METHOD_NOT_FOUND): unknown method"))
    end

    it "reports gateway available but schedule not supported" do
      result = service.call

      expect(result[:gateway_available]).to be(true)
      expect(result[:gateway_supports_schedule]).to be(false)
    end

    it "does not emit calendar_sync_failed (gateway is reachable)" do
      expect(EventStore).not_to receive(:emit).with(hash_including(type: "calendar_sync_failed"))

      service.call
    end
  end

  # ---------------------------------------------------------------------------
  # Idempotency
  # ---------------------------------------------------------------------------
  context "idempotency — calling twice with same gateway data" do
    before do
      allow(gateway).to receive(:rpc)
        .with("schedule.list")
        .and_return({ "jobs" => gateway_jobs })
    end

    it "does not duplicate CronJob records" do
      service.call
      expect { service.call }.not_to change(CronJob, :count)
    end

    it "does not duplicate CalendarEvent records" do
      service.call
      expect { service.call }.not_to change(CalendarEvent, :count)
    end

    it "updates synced_at on subsequent runs" do
      service.call
      cj = CronJob.find_by(gateway_reference: "gw-job-1")
      first_sync = cj.synced_at

      travel_to(1.minute.from_now) do
        service.call
        expect(cj.reload.synced_at).to be > first_sync
      end
    end
  end
end
