require 'rails_helper'

RSpec.describe EventsChannel, type: :channel do
  before { EventStore.clear }

  describe "#subscribed" do
    it "confirms subscription" do
      subscribe
      expect(subscription).to be_confirmed
    end

    it "streams from events:all" do
      subscribe
      expect(subscription.streams).to include("events:all")
    end

    it "also streams per-agent channel when agent_id param is given" do
      subscribe(agent_id: "crabby")
      expect(subscription.streams).to include("events:agent:crabby")
    end

    it "does not add per-agent stream when no agent_id" do
      subscribe
      expect(subscription.streams.any? { |s| s.include?("events:agent:") }).to be false
    end
  end

  describe "#replay" do
    it "transmits stored events to the subscriber" do
      EventStore.emit(type: "test_event", message: "replay test")
      subscribe
      perform :replay, count: 10
      transmitted_types = transmissions.map { |t| t["type"] }
      expect(transmitted_types).to include("test_event")
    end

    it "respects the count limit" do
      15.times { |i| EventStore.emit(type: "batch", message: "event #{i}") }
      subscribe
      perform :replay, count: 5
      expect(transmissions.length).to be <= 5
    end

    it "handles count above max by clamping to 100" do
      subscribe
      perform :replay, count: 9999
      expect(transmissions.length).to be <= 100
    end
  end

  describe "#unsubscribed" do
    it "stops all streams" do
      subscribe
      expect(subscription.streams).not_to be_empty
      unsubscribe
      expect(subscription.streams).to be_empty
    end
  end
end
