(function () {
  'use strict';

  // Deterministic, mocked enterprise connectors for the prototype. Nothing here
  // talks to a real service: the point is to demonstrate how an AI-first Learning
  // Admin agent would enhance the admin's work by pulling audiences from an LMS,
  // checking calendars, and reserving rooms / video. Every result is seeded so
  // the demo and the verification harness stay stable.

  // Hero scenario: 412 reps across three regions due for a certification. The
  // agent recognises this either from the plan id or the AMER/EMEA/APAC session
  // titles and enrolls each region into its matching session.
  var HERO_REGIONS = [
    { key: 'AMER', seats: 180 },
    { key: 'EMEA', seats: 150 },
    { key: 'APAC', seats: 82 }
  ];
  var GENERIC_SEATS_PER_SESSION = 30;

  function hashString(value) {
    var str = String(value || '');
    var hash = 0;
    for (var i = 0; i < str.length; i += 1) {
      hash = (hash * 31 + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }

  function isHeroContext(context) {
    if (!context) return false;
    if (context.planId === 'methodology-rollout') return true;
    return (context.sessions || []).some(function (session) {
      return /AMER|EMEA|APAC/i.test(session.title || '');
    });
  }

  function regionForTitle(title) {
    return HERO_REGIONS.find(function (region) {
      return new RegExp(region.key, 'i').test(title || '');
    }) || null;
  }

  // LMS / HRIS: who should be in the room, and how big each session needs to be.
  function getAudience(context) {
    var sessions = (context && context.sessions) || [];

    if (isHeroContext(context)) {
      var perSession = sessions.map(function (session) {
        var region = regionForTitle(session.title);
        return {
          sessionId: session.id,
          label: region ? region.key : session.title,
          seats: region ? region.seats : 0
        };
      });
      return {
        summary: 'I checked Workday Learning: 412 reps across AMER, EMEA, and APAC are due for this certification before March 31.',
        details: [
          'I can enroll each region into its matching session and size capacity to headcount \u2014 AMER 180, EMEA 150, APAC 82 \u2014 so no region is oversubscribed.'
        ],
        actionLabel: 'Enroll audience & size capacity',
        applyPayload: {
          source: 'Workday Learning',
          total: 412,
          due: 'Mar 31',
          segments: HERO_REGIONS.map(function (region) {
            return { label: region.key, seats: region.seats };
          }),
          perSession: perSession
        }
      };
    }

    var genericPerSession = sessions.map(function (session, index) {
      return { sessionId: session.id, label: 'Cohort ' + (index + 1), seats: GENERIC_SEATS_PER_SESSION };
    });
    var total = GENERIC_SEATS_PER_SESSION * Math.max(sessions.length, 1);
    return {
      summary: 'I found a matching audience in Workday Learning: ' + total + ' learners mapped to your ' + Math.max(sessions.length, 1) + ' session' + (sessions.length === 1 ? '' : 's') + '.',
      details: [
        'I can enroll them from the LMS and size each session to ' + GENERIC_SEATS_PER_SESSION + ' seats.'
      ],
      actionLabel: 'Enroll audience & size capacity',
      applyPayload: {
        source: 'Workday Learning',
        total: total,
        due: '',
        segments: [{ label: 'All learners', seats: total }],
        perSession: genericPerSession
      }
    };
  }

  // Calendar: confirm the proposed windows against instructor + attendee
  // free/busy. This keeps whatever times the event already has (so it never
  // silently erases a real scheduling collision) and simply marks them checked.
  function proposeTimes(context) {
    var sessions = (context && context.sessions) || [];
    var schedules = sessions
      .filter(function (session) { return session.date && session.startTime && session.endTime; })
      .map(function (session) {
        return {
          sessionId: session.id,
          date: session.date,
          startTime: session.startTime,
          endTime: session.endTime,
          timezone: session.timezone,
          label: 'Confirmed via Outlook'
        };
      });
    return {
      summary: 'I checked the instructor and attendee calendars in Outlook for the proposed windows.',
      details: [
        'Every selected window is free across the invited audience, so I can mark each session time confirmed.'
      ],
      actionLabel: 'Confirm times from calendars',
      schedules: schedules
    };
  }

  // Video / room: reserve a room for in-person sessions and create a Zoom link
  // for virtual ones.
  function bookLogistics(context) {
    var sessions = (context && context.sessions) || [];
    var venues = sessions.map(function (session, index) {
      var isVirtual = session.venueMode === 'virtual' || !session.venueMode;
      if (isVirtual) {
        var meetingId = 90000000 + (hashString(session.id) % 9999999);
        return {
          sessionId: session.id,
          venueMode: 'virtual',
          video: 'Zoom',
          link: 'https://zoom.us/j/' + meetingId
        };
      }
      var roomName = 'Training Room ' + ((index % 4) + 1);
      return {
        sessionId: session.id,
        venueMode: 'physical',
        room: roomName,
        location: roomName
      };
    });
    return {
      summary: 'I can reserve space and create video for every session in one step.',
      details: [
        'In-person sessions get a room hold in the facilities system; virtual sessions get a Zoom link.'
      ],
      actionLabel: 'Reserve rooms & create Zoom links',
      venues: venues
    };
  }

  window.ArcticIntegrations = {
    isHeroContext: isHeroContext,
    getAudience: getAudience,
    proposeTimes: proposeTimes,
    bookLogistics: bookLogistics
  };
}());
