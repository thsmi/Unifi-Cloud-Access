import { Logger } from "./../../logger/logger.mjs";

const logger = Logger.getInstance();

/**
 * A wrapper for unify's web rtc peer connection dialect.
 *
 * It relies on some magic, because sometimes signal are
 * received in the wrong sequence.
 */
class UnifiWebRtcConnection {

  /**
   * Creates a new instance.
   *
   * @param {string[]} urls
   *   the remote server urls which can be used for negotiating.
   *   the connection.
   * @param {string} username
   *   the username as string.
   * @param {string} password
   *   the password as string.
   */
  constructor(urls, username, password) {
    this.connection = new RTCPeerConnection({
      "iceServers": [{
        "urls": urls,
        "username": username,
        "credential": password
      }]
    });

    this.negotiator = null;

    this.connection.onnegotiationneeded = () => {
      this?.negotiator?.onLocalNegotiate();
    };

    this.connection.onicecandidate = (ev) => {
      this?.negotiator?.onLocalCandidate(ev.candidate);
    };

    this.connection.onconnectionstatechange = () => {
      const state = this.getRawConnection().connectionState;
      logger.log(`Connection state changed to ${state}`);

      if (state === "failed")
        this?.negotiator?.onError();

      if (state === "connected")
        this?.negotiator?.onSuccess();
    };
  }

  /**
   * Returns the raw peer connection object.
   *
   * @returns {RTCPeerConnection}
   *   the raw peer connection
   */
  getRawConnection() {
    return this.connection;
  }

  /**
   * Returns the list of server endpoints which can be used for
   * the connection negotiation.
   *
   * @returns {string[]}
   *   a list of servers which can be used for the connection brokering.
   */
  getIceServers() {
    return this.getRawConnection().getConfiguration().iceServers;
  }

  /**
   * Creates a new Data Channel
   * @param {string} name
   *   the channel's unique name.
   */
  async createDataChannel(name) {
    await this.getRawConnection().createDataChannel(name);
  }

  /**
   * Checks if a remote answer was received.
   *
   * @returns {boolean}
   *   true in case a remote answer as received otherwise false.
   */
  hasRemoteAnswer() {
    return this.getRawConnection().remoteDescription !== null;
  }

  /**
   * Registers the negotiator which should be notified on signaling events.
   * @param {UnifiWebRTCSessionNegotiator} negotiator
   *   the negotiator which coordinates the negotiation phase.
   */
  setNegotiator(negotiator) {
    this.negotiator = negotiator;
  }

  /**
   * Called whenever the signaling state changes.
   */
  onSignalingStateChange() {
    logger.log(`Signaling state changed : ${this.connection.signalingState}`);
  }

  /**
   * Creates a local offer and registers the description.
   *
   * @returns {string}
   *   the offer's sdp string.
   */
  async createLocalOffer() {
    const offer = await this.connection.createOffer({
      iceRestart: true,
      offerToReceiveAudio: false,
      offerToReceiveVideo: false
    });

    if (!offer.sdp)
      throw new Error("Sdp missing in offer.");

    logger.log(`Setting offer description locally : ${offer}`);
    await this.connection.setLocalDescription(offer);

    return offer.sdp;
  }

  /**
   * Adds the remote answer to the peer connection remote description.
   *
   * @param {string} answer
   *   the answer to be added.
   */
  async setRemoteAnswer(answer) {
    logger.log(`Setting remote answer \n${answer}`);
    await this.connection.setRemoteDescription({
      "sdp": answer,
      "type": "answer"
    });
  }

  /**
   * Adds a remote ice candidate to the peer connection.
   *
   * @param {RTCIceCandidateInit} candidate
   *   the candidate to be added.
   */
  async addRemoteCandidate(candidate) {
    logger.log(`Adding remote candidate \n${candidate.candidate}`);
    await this.connection.addIceCandidate(candidate);
  }

  /**
   * Closes the peer connection.
   */
  async close() {
    this?.connection?.close();
  }
}

export { UnifiWebRtcConnection };
