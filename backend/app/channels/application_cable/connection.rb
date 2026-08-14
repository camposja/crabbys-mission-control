require "ipaddr"

module ApplicationCable
  class Connection < ActionCable::Connection::Base
    identified_by :peer_address

    def connect
      # Mission Control exposes host-level capabilities, including an actual
      # shell. Use the socket peer address rather than forwarded headers so a
      # remote client cannot spoof its way past this local-only boundary.
      self.peer_address = request.env["REMOTE_ADDR"].to_s
      reject_unauthorized_connection unless loopback_peer?
    end

    private

    def loopback_peer?
      IPAddr.new(peer_address).loopback?
    rescue IPAddr::InvalidAddressError
      false
    end
  end
end
