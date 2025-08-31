import { Logger } from "./../../logger/logger.mjs";

const DELAY_EARLY_CANDIDATE = 500;
const DELAY_RELAY_CANDIDATE = 1000;

const NOT_FOUND = -1;

const logger = Logger.getInstance();

/**
 * Implements a negotiator which coordinates the peer connection and
 * the signaling channel during negotiating the connection.
 */
class UnifiWebRtcNegotiator {

  /**
   * Creates a new negotiator instance.
   *
   * @param {UnifiWebRtcConnection} connection
   *   the wrapper for the peer connection.
   * @param {UnifiWebRtcSignaling} signaling
   *   the wrapper for the signaling channel.
   */
  constructor(connection, signaling) {
    this.connection = connection;
    this.signaling = signaling;

    this.connection.setNegotiator(this);
    this.signaling.setNegotiator(this);
  }

  /**
   * Called whenever a remote answer is received.
   * It registers the remote answer with the local peer connection.
   *
   * @param {*} answer
   *   the remote answer.
   */
  async onRemoteAnswer(answer) {
    this.connection.setRemoteAnswer(answer);
  }

  /**
   * Called whenever a new Remote Candidate was discovered.
   * It registers the candidate with the peer connection.
   *
   * In case the remote answer is not yet received the candidate
   * registration will be delayed via a timeout.
   *
   * Likewise any candidates of the type relay are also delayed.
   *
   * @param {*} candidate
   *   the candidate to be registered
   */
  async onRemoteCandidate(candidate) {

    if (!candidate)
      return;

    await this.delayCandidate(candidate.candidate);

    this?.connection?.addRemoteCandidate(candidate);
  }

  /**
   * Delays the call by the given number of seconds.
   * @param {int} delay
   *   the delay in seconds
   */
  async delay(delay) {
    await new Promise((resolve) => {
      setTimeout(() => {resolve();}, delay);
    });
  }

  /**
   * The signaling protocol is not cleanly designed. Thus
   * we may receive candidates before the connection is ready
   *
   * In this case we just delay the candidate.
   *
   * Additionally we alway delay the if the candidate is of
   * a relay type. No clue why this is needed but the original
   * code does it and without it does not work reliably.
   *
   * @param {str} candidate
   *   the candidate to be delayed
   */
  async delayCandidate(candidate) {
    // In case we have no remote description have to wait
    // until either our connection times out or we get the answer.
    while (this.connection) {

      if (this.connection.hasRemoteAnswer())
        break;

      logger.log(`Delaying candidate, no remote answer received yet:\n${candidate}`);
      await this.delay(DELAY_EARLY_CANDIDATE);
    }

    // For some strange reason we need to delay the type relay, don't
    // ask why otherwise it does not pair.
    if (candidate.indexOf("typ relay") === NOT_FOUND)
      return;

    logger.log(`Delaying remote relay candidate:\n${candidate}`);
    await this.delay(DELAY_RELAY_CANDIDATE);
  }

  /**
   * Called when a local channel negotiation is needed.
   *
   * It creates a new local offer and sends it via the signaling channel.
   */
  async onLocalNegotiate() {

    const offer = await this.connection.createLocalOffer();

    await this.signaling.publishLocalOffer(
      offer, this.connection.getIceServers());
  }

  /**
   * Called whenever a local candidate was discovered.
   * It publishes the candidate to the remote via the signaling channel.
   *
   * In case the remote answer is not yet received publishing the candidate
   * will be delayed via a timeout.
   *
   * Likewise any candidates of the type relay are also delayed.
   *
   * @param {*} candidate
   *   the freshly discovered candidate.
   */
  async onLocalCandidate(candidate) {

    if (!candidate)
      return;

    candidate = candidate.candidate;

    await this.delayCandidate(candidate);

    this?.signaling?.publishLocalCandidate(candidate);
  }

  /**
   * Negotiates a connection between the local webrtc endpoint and the remote.
   */
  async negotiate() {

    await this.connection.createDataChannel("placeholder");

    await new Promise((resolve, reject) => {
      this.onSuccess = () => { resolve(); };
      this.onError = () => { reject(new Error("Failed to connect to server")); };
    });
  }
}

export { UnifiWebRtcNegotiator };
