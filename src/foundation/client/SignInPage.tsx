import { useNavigate } from 'react-router-dom';
import { ChevronRight, History, LockKeyhole, ShieldCheck } from 'lucide-react';
import { ROLE_ORDER, ROLES } from '../shared/roles';
import { USERS } from '../shared/users';
import { Logo } from './AppShell';
import { useSession } from './session';
import { Avatar } from './ui';

export function SignInPage() {
  const { signIn } = useSession();
  const navigate = useNavigate();

  return (
    <div className="signin">
      <section className="signin-panel">
        <Logo light />
        <div className="signin-pitch">
          <h1>Internal tools your operations team actually owns.</h1>
          <p>Reviews, approvals and every change on the record — in one small codebase instead of a low-code maze.</p>
          <ul className="signin-points">
            <li>
              <ShieldCheck size={18} /> The server decides who can do what, and says why when it can't.
            </li>
            <li>
              <History size={18} /> Every change is written to the change log — who, what, when.
            </li>
            <li>
              <LockKeyhole size={18} /> Sensitive data is masked before it ever leaves the server.
            </li>
          </ul>
        </div>
        <p className="signin-foot">Demo environment · fictional people and data · resets on restart</p>
      </section>
      <section className="signin-main">
        <div className="signin-box">
          <h2>Sign in as</h2>
          <p className="muted">No passwords in this demo. Pick a person to see Keel through their role.</p>
          {ROLE_ORDER.map((role) => (
            <div key={role} className="signin-group">
              <div className="signin-role">
                <span className={`role-dot role-${role}`} />
                <span className="signin-role-name">{USERS.filter((u) => u.role === role).length > 1 ? ROLES[role].plural : ROLES[role].label}</span>
                <span className="signin-role-summary">{ROLES[role].summary}</span>
              </div>
              {USERS.filter((u) => u.role === role).map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="person"
                  onClick={() => {
                    signIn(u.id);
                    navigate('/');
                  }}
                >
                  <Avatar initials={u.initials} role={u.role} size="lg" />
                  <span className="person-text">
                    <span className="person-name">{u.name}</span>
                    <span className="person-title">{u.title}</span>
                  </span>
                  <ChevronRight size={18} className="person-chevron" />
                </button>
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
