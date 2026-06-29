const { google } = require('googleapis');

const getCalendarClient = (refreshToken, clientId, clientSecret) => {
    const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    return google.calendar({ version: 'v3', auth: oauth2Client });
};

async function checkAvailability(refreshToken, clientId, clientSecret, dateStr, durationMinutes = 30) {
    try {
        const calendar = getCalendarClient(refreshToken, clientId, clientSecret);
        
        // dateStr expected in "YYYY-MM-DD" or similar format
        const timeMin = new Date(dateStr);
        timeMin.setHours(9, 0, 0, 0); // Check from 9 AM
        
        const timeMax = new Date(dateStr);
        timeMax.setHours(17, 0, 0, 0); // To 5 PM
        
        // We could use Freebusy API, but getting events is easier for simple slot finding
        const response = await calendar.events.list({
            calendarId: 'primary',
            timeMin: timeMin.toISOString(),
            timeMax: timeMax.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
        });
        
        const events = response.data.items;
        
        // Calculate available slots between 9 AM to 5 PM
        let availableSlots = [];
        let currentSlot = new Date(timeMin);
        
        while (currentSlot < timeMax) {
            const slotEnd = new Date(currentSlot.getTime() + durationMinutes * 60000);
            
            // Check if this slot overlaps with any event
            const isOverlap = events.some(event => {
                const eventStart = new Date(event.start.dateTime || event.start.date);
                const eventEnd = new Date(event.end.dateTime || event.end.date);
                return (currentSlot < eventEnd && slotEnd > eventStart);
            });
            
            if (!isOverlap) {
                availableSlots.push(currentSlot.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
            }
            
            currentSlot = slotEnd; // Move to next slot
        }
        
        if (availableSlots.length === 0) {
            return `No availability found on ${dateStr}. Please suggest another date.`;
        }
        
        return `Available slots on ${dateStr}: ${availableSlots.join(', ')}`;
    } catch (e) {
        console.error("Availability Check Error:", e);
        return "Failed to check calendar availability due to an internal error.";
    }
}

async function bookAppointment(refreshToken, clientId, clientSecret, summary, startDateISO, durationMinutes = 30) {
    try {
        const calendar = getCalendarClient(refreshToken, clientId, clientSecret);
        
        const startTime = new Date(startDateISO);
        const endTime = new Date(startTime.getTime() + durationMinutes * 60000);
        
        const event = {
            summary: summary || 'WhatsApp Booking',
            description: 'Booked automatically via AI Chatbot.',
            start: {
                dateTime: startTime.toISOString(),
                timeZone: 'UTC', // the user should ideally specify timezone in settings, default to UTC or parse from bot
            },
            end: {
                dateTime: endTime.toISOString(),
                timeZone: 'UTC',
            },
        };
        
        const res = await calendar.events.insert({
            calendarId: 'primary',
            resource: event,
        });
        
        return `Success! Appointment booked for ${startTime.toLocaleString()}. Confirmation Link: ${res.data.htmlLink}`;
    } catch (e) {
        console.error("Booking Error:", e);
        return "Failed to book appointment on the calendar. Provide the user with an alternative.";
    }
}

module.exports = { checkAvailability, bookAppointment };
