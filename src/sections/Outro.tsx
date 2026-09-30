import { content } from '../content';
import { Lettering } from '../fx/Lettering';
import './outro.css';

export function Outro() {
  return (
    <section className="outro" aria-labelledby="outro-title">
      <p className="label">SIDE B · CREDITS</p>
      <Lettering as="h2" id="outro-title" text="CẢM ƠN!" className="outro__title" />
      <p className="outro__thanks">{content.thanks}</p>
      <ol className="tracklist">
        {content.team.map((p, i) => (
          <li key={i}>
            <span className="tracklist__n">{String(i + 1).padStart(2, '0')}</span>
            <span className="tracklist__name">{p.name}</span>
            <span className="tracklist__role">{p.role}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <span className="label label--cream">NOERR · TEAM ONLY</span>
      <a href="#top" className="label">BACK TO TOP</a>
    </footer>
  );
}
