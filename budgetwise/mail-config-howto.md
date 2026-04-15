In order for the software to be able to send email messages to users,
such as reset-password emails,
it must be able to connect to a mail server
to which to submit those email messages.
This behavior of the program is configured via various environment variables,
all prefixed with "MAIL\_SERVER\_".
There are also environment variables configuring certain tasks
that involve sending email messages to users;
for instance,
reset-password email messages are configured
via environment variables
whose names are prefixed with "RESET\_PASSWORD\_".
This document explains how to construct a working configuration
of all these environment variables.

First and foremost,
the software needs to know what mail server to connect to
as well as how to connect to it.
The environment variable "MAIL\_SERVER\_NAME"
sets the host name of the mail server
and defaults to "localhost" when unset.
Throughout this document,
we will assume that the mail server is Google's mail server for Gmail,
but,
in principle,
any mail server should work.
To this end,
we set "MAIL\_SERVER\_NAME" to "smtp.gmail.com" in the environment,
because the latter is the host name of the mail server used by Gmail.
The environment variable "MAIL\_SERVER\_PORT"
then sets the port of the mail server
to which the software connects
and defaults to 465 when unset.
Depending upon the particular mail server,
this port is usually either 25, 465, or 587;
465 is the standard port for connecting to the mail server
directly over TLS,
but a non-TLS connection over the other two ports
can still be upgraded to TLS connection,
the exact mechanism of which is beyond the scope of this document.
Related to this port number
is the environment variable "MAIL\_SERVER\_SECURE",
which indicates whether the connection to the mail server
should be directly over TLS,
with a nonempty value indicating "yes",
and an empty value indicating "no",
and which defaults to "yes".
For our purposes,
we leave both "MAIL\_SERVER\_PORT" and "MAIL\_SERVER\_SECURE" unset
to get their aforementioned defaults.

Next,
the software needs to know how to authenticate itself
to the mail server.
For our purposes,
since we are using Gmail's mail server,
we need a Google account.
To this end,
we shall now explain how to create a throw-away Google account
that we can use for testing the email functionality of the software.
The first step is of course to create a new Google account.
Next,
turn on two-factor authentication upon this account
by going to the account settings page
(usually reachable
by clicking "Account" on the 3-by-3-grid-like button
on the Google homepage)
and navigating to the "Security & sign-in" section.
Next,
create an app password for the account
by entering "app password" into the search field
on the account settings page
and selecting the results titled "App passwords".
The app password will be displayed
as something like "abcd efgh ijkl mnop",
but the actual app password would be "abcdefghijklmnop",
i.e. without the spaces.
Remember to save this app password somewhere
from which you can retrieve it later.
Now,
the environment variables "MAIL\_SERVER\_USER"
and "MAIL\_SERVER\_PASSWORD"
set the username and password,
respectively,
that the software shall use
in order to authenticate itself to the mail server,
and both default to undefined;
for our purposes,
we set "MAIL\_SERVER\_USER"
to the email address of our throw-away Google account
and "MAIL\_SERVER\_PASSWORD"
to the app password that we created for that Google account.

Assuming the environment variables discussed above
have all been set correctly,
the software should now be able to properly connect to the mail server.
However,
the software also needs to know
what values to specify for the fields in the email messages
that it sends to users via the mail server.
The environment variables "RESET\_PASSWORD\_SENDER\_NAME"
and "RESET\_PASSWORD\_SENDER\_ADDRESS"
set the display name and email address,
respectively,
of the sender of reset-password emails
and default to "Budgetwise" and "no-reply@localhost",
respectively.
These variables are largely cosmetic in effect,
for email messages will generally be successfully sent
via the mail server
to their intended recepients regardless of their values.
Indeed,
Gmail automatically replaces the sender's email address
with that of the account sending the email message.
