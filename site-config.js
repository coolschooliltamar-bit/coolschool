/* CoolSchool site settings – edit this file on GitHub to change them for everyone.
 *
 * jitsiDomain: the video server used for live lessons.
 *   'meet.jit.si' is Jitsi's free demo server: the first person in a lesson must sign in
 *   (Google / GitHub / Facebook) and lessons inside our site are cut after 5 minutes.
 *   Put your school's own Jitsi server here (see video-server/README.md), for example:
 *     jitsiDomain: 'meet.yourschool.org.il',
 *   On your own server nobody has to sign in and there is no time limit.
 */
window.COOLSCHOOL_CONFIG = {
  jitsiDomain: 'meet.jit.si',

  /* aiProxyUrl: the school's AI server for the learning-path generator (see ai-proxy/README.md).
   *   Empty: each teacher can paste their own Anthropic API key in their browser to try it,
   *   and the built-in generator (no AI) always works. Example:
   *     aiProxyUrl: 'https://coolschool-ai.yourschool.workers.dev',
   */
  aiProxyUrl: '',
};
