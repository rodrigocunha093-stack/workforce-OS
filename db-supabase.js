const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://megimevuyjaevilogepe.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'sb_publishable_xFO7xF4gyy3VVQFLfGos-w_X2j9eBlv';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function getUser(email) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      console.error('DB Error on getUser:', error.message);
      return null;
    }
    if (!data) return null;
    return mapUser(data);
  } catch (error) {
    console.error('DB Error on getUser:', error.message);
    return null;
  }
}

function mapUser(data) {
  return {
    id: data.id,
    name: data.name,
    email: data.email,
    passwordHash: data.passwordhash,
    passwordSalt: data.passwordsalt,
    inviteCode: data.invitecode,
    orgId: data.orgid || data.id,
    orgCode: data.orgcode || null,
    role: data.role || 'admin',
    createdAt: data.createdat
  };
}

async function getUserByOrgCode(orgCode) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('orgcode', orgCode)
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error('DB Error on getUserByOrgCode:', error.message);
      return null;
    }
    return data ? mapUser(data) : null;
  } catch (error) {
    console.error('DB Error on getUserByOrgCode:', error.message);
    return null;
  }
}

async function listOrgMembers(orgId) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id,name,email,role,createdat')
      .eq('orgid', orgId);
    if (error) { console.error('DB Error on listOrgMembers:', error.message); return []; }
    return (data || []).map(d => ({ id: d.id, name: d.name, email: d.email, role: d.role || 'membro', createdAt: d.createdat }));
  } catch (error) {
    console.error('DB Error on listOrgMembers:', error.message);
    return [];
  }
}

async function getUserById(id) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('DB Error on getUserById:', error.message);
      return null;
    }
    if (!data) return null;
    return mapUser(data);
  } catch (error) {
    console.error('DB Error on getUserById:', error.message);
    return null;
  }
}

async function createUser(user) {
  try {
    const { data, error } = await supabase
      .from('users')
      .insert([{
        id: user.id,
        name: user.name,
        email: user.email,
        passwordhash: user.passwordHash,
        passwordsalt: user.passwordSalt,
        invitecode: user.inviteCode || null,
        orgid: user.orgId || user.id,
        orgcode: user.orgCode || null,
        role: user.role || 'admin'
      }])
      .select();

    if (error) {
      console.error('DB Error on createUser:', error.code, error.message, error.hint, { email: user.email });
      return false;
    }
    console.log('User created:', user.email);
    return true;
  } catch (error) {
    console.error('DB Error on createUser exception:', error.message);
    return false;
  }
}

async function saveSession(token, userId, expiresAt) {
  try {
    const { error } = await supabase
      .from('sessions')
      .upsert([{
        token,
        userid: userId,
        expiresat: new Date(expiresAt).toISOString()
      }]);

    if (error) {
      console.error('DB Error on saveSession:', error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.error('DB Error on saveSession:', error.message);
    return false;
  }
}

async function getSession(token) {
  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('token', token)
      .gt('expiresat', new Date().toISOString())
      .maybeSingle();

    if (error) {
      console.error('DB Error on getSession:', error.message);
      return null;
    }
    if (!data) return null;
    return {
      token: data.token,
      userId: data.userid,
      expiresAt: data.expiresat
    };
  } catch (error) {
    console.error('DB Error on getSession:', error.message);
    return null;
  }
}

async function deleteSession(token) {
  try {
    const { error } = await supabase
      .from('sessions')
      .delete()
      .eq('token', token);

    if (error) {
      console.error('DB Error on deleteSession:', error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.error('DB Error on deleteSession:', error.message);
    return false;
  }
}

async function saveClientData(userId, data) {
  try {
    const { error } = await supabase
      .from('clients')
      .upsert([{
        userid: userId,
        data,
        updatedat: new Date().toISOString()
      }], { onConflict: 'userid' });

    if (error) {
      console.error('DB Error on saveClientData:', error.message, { userId });
      return false;
    }
    return true;
  } catch (error) {
    console.error('DB Error on saveClientData:', error.message);
    return false;
  }
}

async function getClientData(userId) {
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('data')
      .eq('userid', userId)
      .maybeSingle();

    if (error) {
      console.error('DB Error on getClientData:', error.message);
      return null;
    }
    return data ? data.data : null;
  } catch (error) {
    console.error('DB Error on getClientData:', error.message);
    return null;
  }
}

async function auditLog(userId, action, detail) {
  try {
    const { error } = await supabase
      .from('audit')
      .insert([{
        userid: userId,
        action,
        detail
      }]);

    if (error) {
      console.error('DB Error on auditLog:', error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.error('DB Error on auditLog:', error.message);
    return false;
  }
}

module.exports = {
  getUser,
  getUserById,
  getUserByOrgCode,
  listOrgMembers,
  createUser,
  saveSession,
  getSession,
  deleteSession,
  saveClientData,
  getClientData,
  auditLog
};
