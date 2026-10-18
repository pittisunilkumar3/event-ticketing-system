import {Link} from 'react-router-dom';
export default function EventLink({event,children,...props}) {
  // Crossing into another organizer needs a fresh app bootstrap for its API/session scope.
  return event.public_path ? <a href={event.public_path} {...props}>{children}</a> : <Link to={'/events/'+event.slug} {...props}>{children}</Link>;
}
